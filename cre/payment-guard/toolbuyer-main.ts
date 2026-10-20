import {
  Runner,
  cre,
  type Runtime,
  type HTTPSendRequester,
  consensusIdenticalAggregation,
  bytesToHex,
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
  plan,
  type Config,
  type Task,
  type ProviderId,
} from "./toolbuyer-policy";
const ABI = parseAbi([
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
]);
function get(requester: HTTPSendRequester, url: string): string {
  const response = requester.sendRequest({ url, method: "GET" }).result();
  if (!ok(response))
    throw new Error(`Trial provider HTTP ${response.statusCode}`);
  return JSON.stringify(json(response));
}
function select(runtime: Runtime<Config>): string {
  const c = runtime.config,
    evm = new cre.capabilities.EVMClient(16015286601757825753n),
    http = new cre.capabilities.HTTPClient();
  const read = (name: "balanceOf" | "decimals") =>
    bytesToHex(
      evm
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: c.token,
            data:
              name === "decimals"
                ? encodeFunctionData({ abi: ABI, functionName: "decimals" })
                : encodeFunctionData({
                    abi: ABI,
                    functionName: "balanceOf",
                    args: [c.payer as Address],
                  }),
          }),
          blockNumber: blockNumber(c.observationBlock),
        })
        .result().data
    );
  const decimals = Number(
    decodeFunctionResult({
      abi: ABI,
      functionName: "decimals",
      data: read("decimals"),
    })
  );
  if (decimals !== 6) throw new Error("Expected Circle USDC six-decimal units");
  const balanceRaw = decodeFunctionResult({
    abi: ABI,
    functionName: "balanceOf",
    data: read("balanceOf"),
  }).toString();
  const result = plan(c, balanceRaw, (task: Task, provider: ProviderId) => {
    const url = `${
      c.serviceUrl
    }/trial/toolbuyer/${provider}?task=${encodeURIComponent(
      JSON.stringify(task)
    )}`;
    const reply = JSON.parse(
      http
        .sendRequest(
          runtime,
          get,
          consensusIdenticalAggregation()
        )(url)
        .result()
    );
    runtime.log(
      `ToolBuyer trial ${provider}/${c.family}: quoted cost=${reply.costRaw}; answer=${reply.answer}`
    );
    return reply;
  });
  runtime.log(
    `ToolBuyer ${c.family}: ${result.decision.action} ${result.decision.provider}; trials=${result.observations.length}; trial cost=${result.decision.spentRaw}`
  );
  return JSON.stringify({
    schemaVersion: 1,
    workflow: "agentpay-toolbuyer",
    mode: "local-simulation",
    billingMode: "benchmark-credits",
    config: c,
    onchain: {
      balanceRaw,
      tokenDecimals: decimals,
      observationBlock: c.observationBlock,
    },
    ...result,
    observedAt: Math.floor(runtime.now().getTime() / 1000),
    donAuthenticated: false,
    published: false,
  });
}
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run((config) => [
    cre.handler(
      new cre.capabilities.CronCapability().trigger({
        schedule: "0 */5 * * * *",
      }),
      select
    ),
  ]);
}
