import { test, expect } from "bun:test";
import { encodeFunctionData, parseAbi } from "viem";
import { configSchema, digest, evaluate } from "./spend-policy";
const payer = "0xe26468ae02368a75DBDBea58F367B7313942ad26",
  recipient = "0x9950D8950BF80722860f2B6a9e120893a0fE79f7",
  stream = "0x5199d1dcaB9496d37677DAD8F53481DCc511d585",
  token = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const abi = parseAbi([
  "function transfer(address,uint256) returns(bool)",
  "function approve(address,uint256) returns(bool)",
  "function createStream(address,uint256,uint256,string)",
  "function cancelStream(uint256)",
]);
function fixture(
  fn = "transfer",
  args: any[] = [recipient, 10000n],
  to = token
) {
  const intent = {
    id: "0x" + "1".repeat(64),
    chainId: 11155111,
    payer,
    transaction: {
      to,
      data: encodeFunctionData({
        abi,
        functionName: fn as any,
        args: args as any,
      }),
      value: "0",
    },
    createdAt: 100,
    expiresAt: 400,
    policy: {
      token,
      streamAddress: stream,
      recipients: [recipient],
      maxAmountRaw: "10000",
      maxRiskScore: 49,
      qualityRiskScore: 0,
      maxDurationSeconds: 3600,
    },
  };
  const c = configSchema.parse({
    intent,
    intentHash: digest(intent),
    observationBlock: 100,
    blockHash: "0x" + "2".repeat(64),
    serviceUrl: "http://127.0.0.1:1234/audit/1234567890abcdef",
  });
  const o = {
    intentHash: c.intentHash,
    blockNumber: 100,
    blockHash: c.blockHash,
    status: "success" as const,
    returnData: "0x" + "0".repeat(63) + "1",
    gasEstimate: "100000",
    errorCode: null,
  };
  return { c, o, chain: { balanceRaw: "1000000", tokenDecimals: 6 } };
}
test("spend review gates exact bounded transfer and stream approval calldata", () => {
  for (const [fn, args, to] of [
    ["transfer", [recipient, 10000n], token],
    ["approve", [stream, 10000n], token],
    ["createStream", [recipient, 1000n, 10000n, "session"], stream],
    ["cancelStream", [1n], stream],
  ] as any) {
    const { c, o, chain } = fixture(fn, args, to);
    expect(evaluate(c, o, chain, 100).action).toBe("ALLOW");
  }
});
test("spend review blocks oversized or unlimited approvals and substituted recipients or targets", () => {
  for (const [fn, args, to] of [
    ["transfer", [recipient, 200000n], token],
    ["approve", [stream, 2n ** 256n - 1n], token],
    ["approve", [recipient, 10000n], token],
    ["transfer", [payer, 10000n], token],
    ["cancelStream", [1n], token],
  ] as any) {
    const { c, o, chain } = fixture(fn, args, to);
    expect(evaluate(c, o, chain, 100).action).toBe("BLOCK");
  }
});
test("spend review preserves hard blocks even with a low risk score and errors on unavailable simulation", () => {
  const { c, o, chain } = fixture();
  expect(evaluate(c, { ...o, status: "reverted" }, chain, 100).reason).toBe(
    "SIMULATION_REVERTED"
  );
  expect(evaluate(c, { ...o, status: "unavailable" }, chain, 100).action).toBe(
    "ERROR"
  );
  expect(
    evaluate(c, { ...o, returnData: "0x" + "0".repeat(64) }, chain, 100).reason
  ).toBe("TOKEN_RETURN_NOT_TRUE");
  expect(evaluate(c, o, { ...chain, balanceRaw: "9999" }, 100).reason).toBe(
    "INSUFFICIENT_TOKEN_BALANCE"
  );
  expect(evaluate(c, o, { ...chain, tokenDecimals: 18 }, 100).reason).toBe(
    "TOKEN_UNITS_MISMATCH"
  );
});
test("spend review binds hashes, blocks and freshness; risk uncertainty cannot prevent refund cancellation", () => {
  const { c, o, chain } = fixture();
  expect(evaluate(c, { ...o, blockNumber: 101 }, chain, 100).action).toBe(
    "ERROR"
  );
  expect(evaluate(c, o, chain, 400).reason).toBe("INTENT_EXPIRED");
  c.intent.policy.qualityRiskScore = 80;
  c.intentHash = digest(c.intent);
  o.intentHash = c.intentHash;
  expect(evaluate(c, o, chain, 100).reason).toBe("RISK_THRESHOLD");
  const close = fixture("cancelStream", [1n], stream);
  close.c.intent.policy.qualityRiskScore = 100;
  close.c.intentHash = digest(close.c.intent);
  close.o.intentHash = close.c.intentHash;
  expect(evaluate(close.c, close.o, chain, 100).action).toBe("ALLOW");
});
