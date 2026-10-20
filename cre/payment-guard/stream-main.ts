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
  streamConfigSchema,
  healthSchema,
  evaluateStream,
  type StreamConfig,
  type ChainObservation,
} from "./stream-policy";
const ABI = parseAbi([
  "function paymentToken() view returns(address)",
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
  "function streams(uint256) view returns(address sender,address recipient,uint256 totalAmount,uint256 flowRate,uint256 startTime,uint256 stopTime,uint256 amountWithdrawn,bool isActive,string metadata)",
  "function getClaimableBalance(uint256) view returns(uint256)",
]);
function fetchHealth(requester: HTTPSendRequester, url: string): string {
  const response = requester.sendRequest({ url, method: "GET" }).result();
  if (!ok(response))
    throw new Error(`Health snapshot HTTP ${response.statusCode}`);
  return JSON.stringify(healthSchema.parse(json(response)));
}
function supervise(runtime: Runtime<StreamConfig>): string {
  const c = runtime.config,
    evm = new cre.capabilities.EVMClient(16015286601757825753n);
  const http = new cre.capabilities.HTTPClient();
  const health = healthSchema.parse(
    JSON.parse(
      http
        .sendRequest(
          runtime,
          fetchHealth,
          consensusIdenticalAggregation()
        )(c.healthUrl)
        .result()
    )
  );
  const call = (address: string, data: `0x${string}`) =>
    bytesToHex(
      evm
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: address as Address,
            data,
          }),
          blockNumber: blockNumber(c.observationBlock),
        })
        .result().data
    );
  const paymentToken = decodeFunctionResult({
    abi: ABI,
    functionName: "paymentToken",
    data: call(
      c.streamAddress,
      encodeFunctionData({ abi: ABI, functionName: "paymentToken" })
    ),
  });
  const tokenDecimals = Number(
    decodeFunctionResult({
      abi: ABI,
      functionName: "decimals",
      data: call(
        c.token,
        encodeFunctionData({ abi: ABI, functionName: "decimals" })
      ),
    })
  );
  const agentBalanceRaw = decodeFunctionResult({
    abi: ABI,
    functionName: "balanceOf",
    data: call(
      c.token,
      encodeFunctionData({
        abi: ABI,
        functionName: "balanceOf",
        args: [c.agent as Address],
      })
    ),
  }).toString();
  let stream: ChainObservation["stream"] = null;
  if (c.phase === "checkpoint") {
    const s = decodeFunctionResult({
      abi: ABI,
      functionName: "streams",
      data: call(
        c.streamAddress,
        encodeFunctionData({
          abi: ABI,
          functionName: "streams",
          args: [BigInt(c.streamId)],
        })
      ),
    });
    const claimable = s[7]
      ? decodeFunctionResult({
          abi: ABI,
          functionName: "getClaimableBalance",
          data: call(
            c.streamAddress,
            encodeFunctionData({
              abi: ABI,
              functionName: "getClaimableBalance",
              args: [BigInt(c.streamId)],
            })
          ),
        })
      : 0n;
    stream = {
      sender: s[0],
      recipient: s[1],
      totalAmount: s[2].toString(),
      flowRate: s[3].toString(),
      startTime: s[4].toString(),
      stopTime: s[5].toString(),
      amountWithdrawn: s[6].toString(),
      isActive: s[7],
      metadata: s[8],
      claimableRaw: claimable.toString(),
    };
  }
  const onchain = { paymentToken, tokenDecimals, agentBalanceRaw, stream };
  const decision = evaluateStream(c, health, onchain);
  runtime.log(
    `Stream supervisor: ${decision.action} (${decision.reason}); block=${c.observationBlock}`
  );
  return JSON.stringify({
    schemaVersion: 1,
    workflow: "agentpay-stream-supervisor",
    mode: "local-simulation",
    config: c,
    health,
    onchain,
    ...decision,
    observedAt: Math.floor(runtime.now().getTime() / 1000),
    donAuthenticated: false,
  });
}
const initWorkflow = (config: StreamConfig) => [
  cre.handler(
    new cre.capabilities.CronCapability().trigger({
      schedule: "0 */5 * * * *",
    }),
    supervise
  ),
];
export async function main() {
  const runner = await Runner.newRunner<StreamConfig>({
    configSchema: streamConfigSchema,
  });
  await runner.run(initWorkflow);
}
