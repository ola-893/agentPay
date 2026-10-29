import { test, expect } from "bun:test";
import {
  streamConfigSchema,
  healthSchema,
  evaluateStream,
  validateStreamResult,
} from "./stream-policy";
import raw from "./config.stream.json";
const c = streamConfigSchema.parse(raw);
const onchain = {
  paymentToken: c.token,
  tokenDecimals: 6,
  agentBalanceRaw: "40000000",
  stream: null,
};
const checkpoint = () => ({
  ...c,
  phase: "checkpoint" as const,
  streamId: "1",
});
const active = () => ({
  ...onchain,
  stream: {
    sender: c.agent,
    recipient: c.recipient,
    totalAmount: c.amountRaw,
    flowRate: "10",
    startTime: "1000",
    stopTime: "2000",
    amountWithdrawn: "0",
    isActive: true,
    metadata: JSON.stringify({ sessionId: c.sessionId, quoteId: c.quoteId }),
    claimableRaw: "3000",
  },
});
test("admits a healthy funded USDC stream with bounded deposit and rate", () => {
  expect(evaluateStream(c, c.expectedHealth, onchain)).toEqual({
    action: "OPEN",
    reason: "HEALTHY_WITHIN_BUDGET",
  });
});
test("denies over-budget, zero-rate and wrong-token admission", () => {
  expect(
    evaluateStream({ ...c, amountRaw: "200000" }, c.expectedHealth, onchain)
      .reason
  ).toBe("AMOUNT_EXCEEDS_POLICY");
  expect(
    evaluateStream({ ...c, amountRaw: "100" }, c.expectedHealth, onchain).reason
  ).toBe("RATE_EXCEEDS_POLICY");
  expect(
    evaluateStream(c, c.expectedHealth, { ...onchain, tokenDecimals: 18 })
      .reason
  ).toBe("WRONG_PAYMENT_TOKEN");
});
test("checks available USDC balance before opening", () => {
  expect(
    evaluateStream(c, c.expectedHealth, { ...onchain, agentBalanceRaw: "9999" })
      .reason
  ).toBe("INSUFFICIENT_BALANCE");
});
test("continues a matching active stream without changing its funded parameters", () => {
  expect(evaluateStream(checkpoint(), c.expectedHealth, active())).toEqual({
    action: "CONTINUE",
    reason: "SERVICE_HEALTHY",
  });
});
test("closes on observed service outage, with client and provider counters bound", () => {
  const health = {
    ...c.expectedHealth,
    serviceAvailable: false,
    failedRequests: 3,
  };
  const next = {
    ...checkpoint(),
    expectedHealth: health,
    client: { successfulRequests: 0, failedRequests: 3 },
  };
  expect(evaluateStream(next, health, active())).toEqual({
    action: "CLOSE",
    reason: "SERVICE_UNAVAILABLE",
  });
});
test("client/provider disagreement fails closed", () => {
  const health = { ...c.expectedHealth, successfulRequests: 5 };
  expect(
    evaluateStream(
      { ...checkpoint(), expectedHealth: health },
      health,
      active()
    ).reason
  ).toBe("CLIENT_PROVIDER_DISAGREEMENT");
});
test("rejects altered stream party, amount, duration and metadata", () => {
  for (const change of [
    { recipient: c.agent },
    { totalAmount: "9000" },
    { stopTime: "2001" },
    { metadata: "{}" },
  ])
    expect(
      evaluateStream(checkpoint(), c.expectedHealth, {
        ...active(),
        stream: { ...active().stream, ...change },
      }).reason
    ).toBe("STREAM_INTENT_MISMATCH");
});
test("schema rejects cross-chain, external health endpoints and incorrect phase IDs", () => {
  for (const change of [
    { chainId: 1 },
    { healthUrl: "https://untrusted.example/health" },
    { streamId: "1" },
    { durationSeconds: 0 },
    { quoteId: "bad" },
    { recipient: c.streamAddress },
    { recipient: c.token },
  ])
    expect(streamConfigSchema.safeParse({ ...raw, ...change }).success).toBe(
      false
    );
});
test("result validation rejects invented decisions or a substituted stream config", () => {
  const result = {
    schemaVersion: 1,
    workflow: "agentpay-stream-supervisor",
    mode: "local-simulation",
    config: c,
    health: c.expectedHealth,
    onchain,
    ...evaluateStream(c, c.expectedHealth, onchain),
  };
  expect(validateStreamResult(c, result)).toBe(result);
  expect(() =>
    validateStreamResult(c, { ...result, action: "CONTINUE" })
  ).toThrow();
  expect(() =>
    validateStreamResult(c, { ...result, config: { ...c, amountRaw: "1" } })
  ).toThrow();
});
test("shutdown closes an exactly bound healthy stream without inventing an outage", () => {
  const shutdown = streamConfigSchema.parse({ ...checkpoint(), phase: "shutdown" });
  expect(evaluateStream(shutdown, c.expectedHealth, active())).toEqual({
    action: "CLOSE", reason: "CLIENT_SHUTDOWN",
  });
  expect(evaluateStream(checkpoint(), c.expectedHealth, active()).action).toBe("CONTINUE");
  for (const change of [{recipient:c.agent}, {metadata:"{}"}, {totalAmount:"9999"}, {stopTime:"2001"}])
    expect(evaluateStream(shutdown, c.expectedHealth, {
      ...active(), stream: {...active().stream, ...change},
    }).reason).toBe("STREAM_INTENT_MISMATCH");
  expect(streamConfigSchema.safeParse({...shutdown,streamId:"0"}).success).toBe(false);
  const health = {...c.expectedHealth,successfulRequests:1};
  expect(evaluateStream({...shutdown,expectedHealth:health},health,active()).reason).toBe("CLIENT_PROVIDER_DISAGREEMENT");
});
