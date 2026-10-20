import { z } from "zod";
import { isAddress, zeroAddress } from "viem";
import { SEPOLIA_USDC } from "./policy";
const party = z
  .string()
  .refine((s) => isAddress(s) && s.toLowerCase() !== zeroAddress);
const uint = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((s) => /^(0|[1-9][0-9]*)$/.test(s) && BigInt(s) < 2n ** 256n);
const positive = uint.refine((s) => /^[1-9][0-9]*$/.test(s) && BigInt(s) > 0n);
const id = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .refine((s) => /^0x[0-9a-fA-F]{64}$/.test(s) && BigInt(s) !== 0n);
export const healthSchema = z
  .object({
    sessionId: id,
    observationId: id,
    serviceAvailable: z.boolean(),
    successfulRequests: z.number().int().min(0),
    failedRequests: z.number().int().min(0),
  })
  .strict();
export const streamConfigSchema = z
  .object({
    chainId: z.literal(11155111),
    token: party.refine((s) => s.toLowerCase() === SEPOLIA_USDC.toLowerCase()),
    tokenDecimals: z.literal(6),
    streamAddress: party,
    requestId: id,
    quoteId: id,
    sessionId: id,
    agent: party,
    recipient: party,
    amountRaw: positive,
    spendingCapRaw: positive,
    durationSeconds: z.number().int().min(1).max(3600),
    maxRateRawPerSecond: positive,
    phase: z.enum(["admission", "checkpoint"]),
    streamId: uint,
    observationBlock: z.number().int().positive(),
    healthUrl: z
      .string()
      .regex(
        /^http:\/\/127\.0\.0\.1:[0-9]{1,5}\/[a-zA-Z0-9/_.-]+$/,
        "Local demo health endpoint required"
      ),
    expectedHealth: healthSchema,
    client: z
      .object({
        successfulRequests: z.number().int().min(0),
        failedRequests: z.number().int().min(0),
      })
      .strict(),
    maxFailedRequests: z.number().int().min(1).max(10),
  })
  .strict()
  .refine(
    (c) =>
      c.agent.toLowerCase() !== c.recipient.toLowerCase() &&
      c.recipient.toLowerCase() !== c.streamAddress.toLowerCase() &&
      c.recipient.toLowerCase() !== c.token.toLowerCase(),
    "Distinct recipient required"
  )
  .refine(
    (c) =>
      c.phase === "admission"
        ? c.streamId === "0"
        : /^[1-9][0-9]*$/.test(c.streamId),
    "Stream ID does not match phase"
  )
  .refine(
    (c) => c.expectedHealth.sessionId === c.sessionId,
    "Wrong health session"
  );
export type StreamConfig = z.infer<typeof streamConfigSchema>;
export const chainSchema = z
  .object({
    paymentToken: party,
    tokenDecimals: z.number().int(),
    agentBalanceRaw: uint,
    stream: z
      .object({
        sender: z.string(),
        recipient: z.string(),
        totalAmount: uint,
        flowRate: uint,
        startTime: uint,
        stopTime: uint,
        amountWithdrawn: uint,
        isActive: z.boolean(),
        metadata: z.string(),
        claimableRaw: uint,
      })
      .nullable(),
  })
  .strict();
export type ChainObservation = z.infer<typeof chainSchema>;
export function evaluateStream(
  c: StreamConfig,
  health: z.infer<typeof healthSchema>,
  chain: ChainObservation
) {
  const reject = (reason: string) => ({
    action: c.phase === "admission" ? "DENY" : "CLOSE",
    reason,
  });
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!same(chain.paymentToken, c.token) || chain.tokenDecimals !== 6)
    return reject("WRONG_PAYMENT_TOKEN");
  const rate = BigInt(c.amountRaw) / BigInt(c.durationSeconds);
  if (BigInt(c.amountRaw) > BigInt(c.spendingCapRaw))
    return reject("AMOUNT_EXCEEDS_POLICY");
  if (rate === 0n || rate > BigInt(c.maxRateRawPerSecond))
    return reject("RATE_EXCEEDS_POLICY");
  if (
    JSON.stringify(health) !== JSON.stringify(c.expectedHealth) ||
    health.sessionId !== c.sessionId
  )
    return reject("HEALTH_BINDING_MISMATCH");
  if (
    health.successfulRequests !== c.client.successfulRequests ||
    health.failedRequests !== c.client.failedRequests
  )
    return reject("CLIENT_PROVIDER_DISAGREEMENT");
  if (
    !health.serviceAvailable ||
    c.client.failedRequests >= c.maxFailedRequests
  )
    return reject("SERVICE_UNAVAILABLE");
  if (c.phase === "admission") {
    if (chain.stream !== null) return reject("UNEXPECTED_STREAM");
    if (BigInt(chain.agentBalanceRaw) < BigInt(c.amountRaw))
      return reject("INSUFFICIENT_BALANCE");
    return { action: "OPEN", reason: "HEALTHY_WITHIN_BUDGET" };
  }
  const s = chain.stream;
  if (
    !s ||
    !same(s.sender, c.agent) ||
    !same(s.recipient, c.recipient) ||
    s.totalAmount !== c.amountRaw ||
    s.metadata !==
      JSON.stringify({ sessionId: c.sessionId, quoteId: c.quoteId }) ||
    BigInt(s.stopTime) - BigInt(s.startTime) !== BigInt(c.durationSeconds) ||
    BigInt(s.flowRate) !== rate
  )
    return reject("STREAM_INTENT_MISMATCH");
  if (!s.isActive) return { action: "CLOSE", reason: "STREAM_INACTIVE" };
  if (
    BigInt(s.claimableRaw) + BigInt(s.amountWithdrawn) >=
    BigInt(s.totalAmount)
  )
    return { action: "CLOSE", reason: "STREAM_FINISHED" };
  return { action: "CONTINUE", reason: "SERVICE_HEALTHY" };
}
export function validateStreamResult(config: StreamConfig, result: any) {
  if (
    result?.workflow !== "agentpay-stream-supervisor" ||
    result.schemaVersion !== 1 ||
    result.mode !== "local-simulation" ||
    JSON.stringify(result.config) !== JSON.stringify(config)
  )
    throw new Error("Wrong workflow or bound stream intent");
  const health = healthSchema.parse(result.health),
    chain = chainSchema.parse(result.onchain);
  const expected = evaluateStream(config, health, chain);
  if (expected.action !== result.action || expected.reason !== result.reason)
    throw new Error("Stream decision contradicts observations");
  return result;
}
