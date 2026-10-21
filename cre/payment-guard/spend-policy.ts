import { z } from "zod";
import {
  decodeFunctionData,
  parseAbi,
  isAddress,
  zeroAddress,
  keccak256,
  toBytes,
} from "viem";
import { SEPOLIA_USDC } from "./policy";
const uint = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((s) => BigInt(s) < 2n ** 256n);
const hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const address = z
  .string()
  .refine((s): boolean => isAddress(s) && s.toLowerCase() !== zeroAddress);
export const intentSchema = z
  .object({
    id: hash,
    chainId: z.literal(11155111),
    payer: address,
    transaction: z
      .object({
        to: address,
        data: z
          .string()
          .regex(/^0x([0-9a-fA-F]{2})*$/)
          .max(12000),
        value: uint,
      })
      .strict(),
    createdAt: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
    policy: z
      .object({
        token: z.literal(SEPOLIA_USDC),
        streamAddress: address,
        recipients: z.array(address).min(1).max(20),
        maxAmountRaw: uint,
        maxRiskScore: z.number().int().min(0).max(99),
        qualityRiskScore: z.number().int().min(0).max(100),
        maxDurationSeconds: z.number().int().positive().max(3600),
      })
      .strict(),
  })
  .strict()
  .refine(
    (i) => i.expiresAt > i.createdAt && i.expiresAt <= i.createdAt + 600,
    "Expiry must be within ten minutes"
  );
export const configSchema = z
  .object({
    intent: intentSchema,
    intentHash: hash,
    observationBlock: z.number().int().positive(),
    blockHash: hash,
    serviceUrl: z
      .string()
      .regex(/^http:\/\/127\.0\.0\.1:[0-9]{1,5}\/audit\/[a-f0-9]{16}$/),
  })
  .strict();
export type Intent = z.infer<typeof intentSchema>;
export type Config = z.infer<typeof configSchema>;
export const simulationSchema = z
  .object({
    intentHash: hash,
    blockNumber: z.number().int().positive(),
    blockHash: hash,
    status: z.enum(["success", "reverted", "unavailable"]),
    returnData: z.string().regex(/^0x[0-9a-fA-F]*$/),
    gasEstimate: uint.nullable(),
    errorCode: z.string().max(100).nullable(),
  })
  .strict();
const ABI = parseAbi([
  "function approve(address spender,uint256 amount) returns(bool)",
  "function transfer(address recipient,uint256 amount) returns(bool)",
  "function createStream(address recipient,uint256 duration,uint256 amount,string metadata)",
  "function cancelStream(uint256 streamId)",
]);
export function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export const digest = (v: any) => keccak256(toBytes(canonical(v)));
export function evaluate(
  c: Config,
  observation: z.infer<typeof simulationSchema>,
  chain: { balanceRaw: string; tokenDecimals: number },
  now: number
) {
  const i = c.intent,
    p = i.policy,
    same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const finish = (
    action: "ALLOW" | "BLOCK" | "ERROR",
    reason: string,
    riskScore: number,
    operation = "unknown"
  ) => ({ action, reason, riskScore, operation });
  if (
    digest(i) !== c.intentHash ||
    observation.intentHash !== c.intentHash ||
    observation.blockNumber !== c.observationBlock ||
    observation.blockHash !== c.blockHash
  )
    return finish("ERROR", "OBSERVATION_BINDING_MISMATCH", 100);
  if (now < i.createdAt || now >= i.expiresAt)
    return finish("BLOCK", "INTENT_EXPIRED", 100);
  if (i.transaction.value !== "0")
    return finish("BLOCK", "NATIVE_VALUE_FORBIDDEN", 100);
  if (chain.tokenDecimals !== 6)
    return finish("BLOCK", "TOKEN_UNITS_MISMATCH", 100);
  let decoded;
  try {
    decoded = decodeFunctionData({
      abi: ABI,
      data: i.transaction.data as `0x${string}`,
    });
  } catch {
    return finish("BLOCK", "UNSUPPORTED_CALLDATA", 100);
  }
  const operation = decoded.functionName,
    args = decoded.args as readonly any[];
  let amount = 0n;
  if (operation === "approve") {
    if (!same(i.transaction.to, p.token) || !same(args[0], p.streamAddress))
      return finish("BLOCK", "SPENDER_NOT_ALLOWED", 100, operation);
    amount = args[1];
  } else if (operation === "transfer" || operation === "createStream") {
    if (
      !same(
        i.transaction.to,
        operation === "transfer" ? p.token : p.streamAddress
      ) ||
      !p.recipients.some((r) => same(r, args[0]))
    )
      return finish("BLOCK", "RECIPIENT_OR_TARGET_NOT_ALLOWED", 100, operation);
    amount = operation === "transfer" ? args[1] : args[2];
    if (amount <= 0n) return finish("BLOCK", "ZERO_AMOUNT", 100, operation);
    if (
      operation === "createStream" &&
      (args[1] <= 0n ||
        args[1] > BigInt(p.maxDurationSeconds) ||
        amount / args[1] === 0n)
    )
      return finish("BLOCK", "STREAM_RATE_OR_DURATION", 100, operation);
    if (amount > BigInt(chain.balanceRaw))
      return finish("BLOCK", "INSUFFICIENT_TOKEN_BALANCE", 100, operation);
  } else if (!same(i.transaction.to, p.streamAddress))
    return finish("BLOCK", "TARGET_NOT_ALLOWED", 100, operation);
  if (amount > BigInt(p.maxAmountRaw))
    return finish("BLOCK", "AMOUNT_EXCEEDS_CAP", 100, operation);
  if (observation.status === "unavailable")
    return finish("ERROR", "SIMULATION_UNAVAILABLE", 100, operation);
  if (observation.status === "reverted")
    return finish("BLOCK", "SIMULATION_REVERTED", 100, operation);
  if (
    ["approve", "transfer"].includes(operation) &&
    observation.returnData.toLowerCase() !== "0x" + "0".repeat(63) + "1"
  )
    return finish("BLOCK", "TOKEN_RETURN_NOT_TRUE", 100, operation);
  const utilization =
    operation === "cancelStream" || amount === 0n
      ? 0
      : amount * 100n > BigInt(chain.balanceRaw) * 10n
      ? 20
      : 0;
  const riskScore = Math.min(
    100,
    5 + utilization + (operation === "cancelStream" ? 0 : p.qualityRiskScore)
  );
  return finish(
    riskScore > p.maxRiskScore ? "BLOCK" : "ALLOW",
    riskScore > p.maxRiskScore ? "RISK_THRESHOLD" : "WITHIN_POLICY",
    riskScore,
    operation
  );
}
