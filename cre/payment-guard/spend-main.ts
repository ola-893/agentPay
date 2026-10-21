import {
  Runner,
  cre,
  type Runtime,
  type HTTPSendRequester,
  consensusIdenticalAggregation,
  bytesToHex,
  bytesToBase64,
  encodeCallMsg,
  blockNumber,
  json,
  ok,
} from "@chainlink/cre-sdk";
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
  type Address,
} from "viem";
import {
  configSchema,
  simulationSchema,
  evaluate,
  type Config,
} from "./spend-policy";
const ABI = parseAbi([
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
]);
function post(
  requester: HTTPSendRequester,
  input: { url: string; value: unknown }
): string {
  const response = requester
    .sendRequest({
      url: input.url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bytesToBase64(
        new TextEncoder().encode(JSON.stringify(input.value))
      ),
    })
    .result();
  if (!ok(response)) throw new Error(`Audit API HTTP ${response.statusCode}`);
  return JSON.stringify(json(response));
}
function review(runtime: Runtime<Config>): string {
  const c = runtime.config,
    http = new cre.capabilities.HTTPClient(),
    evm = new cre.capabilities.EVMClient(16015286601757825753n);
  const request = (route: string, value: unknown) =>
    JSON.parse(
      http
        .sendRequest(
          runtime,
          post,
          consensusIdenticalAggregation()
        )({ url: c.serviceUrl + route, value })
        .result()
    );
  const simulation = simulationSchema.parse(
    request("/simulate", { intentId: c.intent.id })
  );
  const read = (name: "decimals" | "balanceOf") =>
    bytesToHex(
      evm
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: c.intent.policy.token,
            data:
              name === "decimals"
                ? encodeFunctionData({ abi: ABI, functionName: "decimals" })
                : encodeFunctionData({
                    abi: ABI,
                    functionName: "balanceOf",
                    args: [c.intent.payer as Address],
                  }),
          }),
          blockNumber: blockNumber(c.observationBlock),
        })
        .result().data
    );
  const chain = {
    tokenDecimals: Number(
      decodeFunctionResult({
        abi: ABI,
        functionName: "decimals",
        data: read("decimals"),
      })
    ),
    balanceRaw: decodeFunctionResult({
      abi: ABI,
      functionName: "balanceOf",
      data: read("balanceOf"),
    }).toString(),
  };
  const evaluatedAt = Math.floor(runtime.now().getTime() / 1000);
  const decision = evaluate(c, simulation, chain, evaluatedAt);
  const record = {
    schemaVersion: 1,
    type: "spend-review",
    source: "local-cre-simulation",
    donAuthenticated: false,
    intentId: c.intent.id,
    intentHash: c.intentHash,
    intent: c.intent,
    observedBlock: c.observationBlock,
    blockHash: c.blockHash,
    simulation,
    chain,
    evaluatedAt,
    decision,
    policyVersion: "spend-risk-v1",
    expiresAt: c.intent.expiresAt,
  };
  const stored = request("/decisions", record);
  runtime.log(
    `Spend ${decision.action}: ${decision.reason}; risk=${decision.riskScore}; blob=${stored.blobHash}`
  );
  return JSON.stringify({
    workflow: "agentpay-spend-review",
    mode: "local-simulation",
    record,
    stored,
  });
}
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(() => [
    cre.handler(
      new cre.capabilities.CronCapability().trigger({
        schedule: "0 */5 * * * *",
      }),
      review
    ),
  ]);
}
