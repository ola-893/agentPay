import {
  Runner, cre, type Runtime, type HTTPSendRequester,
  consensusMedianAggregation, bytesToHex, encodeCallMsg, LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest, ok, json, TxStatus,
} from '@chainlink/cre-sdk';
import { decodeFunctionResult, encodeFunctionData, encodeAbiParameters, parseAbi, parseAbiParameters, zeroAddress, type Address } from 'viem';
import { configSchema, evaluate, parseMarketQuote, type Config } from './policy';

const FEED = parseAbi([
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

const fetchMarketPrice = (requester: HTTPSendRequester, config: Config): bigint => {
  const response = requester.sendRequest({ url: config.marketApiUrl, method: 'GET' }).result();
  if (!ok(response)) throw new Error(`Market API returned ${response.statusCode}`);
  return parseMarketQuote(json(response));
};

function onPaymentCheck(runtime: Runtime<Config>): string {
  const config = runtime.config;
  const evm = new cre.capabilities.EVMClient(16015286601757825753n);
  const http = new cre.capabilities.HTTPClient();
  const externalPrice = http.sendRequest(runtime, fetchMarketPrice, consensusMedianAggregation())(config).result();
  runtime.log(`External USDC/USD quote (8 decimals): ${externalPrice}`);

  const read = (functionName: 'decimals' | 'latestRoundData' | 'description', address = config.priceFeedAddress) => {
    const response = evm.callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: address as Address, data: encodeFunctionData({ abi: FEED, functionName }) }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    }).result();
    return bytesToHex(response.data);
  };
  const decimals = decodeFunctionResult({ abi: FEED, functionName: 'decimals', data: read('decimals') });
  const description = decodeFunctionResult({ abi: FEED, functionName: 'description', data: read('description') });
  if (description !== 'USDC / USD') throw new Error('Unexpected Chainlink feed pair');
  const tokenDecimals = decodeFunctionResult({ abi: FEED, functionName: 'decimals', data: read('decimals', config.request.token) });
  if (tokenDecimals !== config.tokenDecimals) throw new Error('Unexpected USDC token decimals');
  const [roundId, price, , updatedAt, answeredInRound] = decodeFunctionResult({ abi: FEED, functionName: 'latestRoundData', data: read('latestRoundData') });
  const now = Math.floor(runtime.now().getTime() / 1000);
  const decision = evaluate(config, { price, decimals, updatedAt: Number(updatedAt), roundId, answeredInRound }, externalPrice, now);
  runtime.log(`Chainlink Sepolia USDC/USD: ${price}; updatedAt=${updatedAt}; round=${roundId}; payment token decimals=${tokenDecimals}`);
  runtime.log(`Payment guard: ${decision.approved ? 'ALLOW' : 'DENY'} (${decision.reason})`);

  // Destination fields prevent cross-chain / cross-receiver replay. Request IDs are single-use.
  const validUntil = now + config.authorizationTtlSeconds;
  const encoded = encodeAbiParameters(
    parseAbiParameters('uint256, address, bytes32, address, address, address, uint256, uint64, bool'),
    [BigInt(config.chainId), config.receiverAddress as Address, config.request.requestId as `0x${string}`, config.request.agent as Address,
      config.request.recipient as Address, config.request.token as Address, BigInt(config.request.amount), BigInt(validUntil), decision.approved],
  );
  const report = runtime.report(prepareReportRequest(encoded)).result();
  let reportWriteSucceeded = false;
  let reportTransactionHash: string | null = null;
  if (config.publishReport) {
    const result = evm.writeReport(runtime, {
      receiver: config.receiverAddress,
      report,
      gasConfig: { gasLimit: '500000' },
    }).result();
    // A failed write must fail the workflow rather than claim publication.
    if (result.txStatus !== TxStatus.SUCCESS) throw new Error(`Report write failed with status ${result.txStatus}`);
    if (result.receiverContractExecutionStatus !== undefined && result.receiverContractExecutionStatus !== 0) throw new Error('Receiver rejected the report');
    reportWriteSucceeded = true;
    reportTransactionHash = result.txHash?.length ? bytesToHex(result.txHash) : null;
  }
  const output = {
    schemaVersion: 2, workflow: 'agentpay-payment-guard', mode: config.publishReport ? 'report-write' : 'simulation-preview',
    policyPurpose: 'usdc-depeg-and-disagreement-guard', pricePair: 'USDC/USD', tokenSymbol: config.tokenSymbol, tokenDecimals,
    testnetTokenHasValue: false, pegTargetUsd8: '100000000', maxPegDeviationBps: config.maxPegDeviationBps,
    chainId: config.chainId, chainName: config.chainName, feedAddress: config.priceFeedAddress,
    marketApiUrl: config.marketApiUrl, request: config.request, receiverAddress: config.receiverAddress,
    ...decision, observedAt: now, validUntil, feedUpdatedAt: Number(updatedAt), feedRoundId: roundId.toString(),
    chainlinkPriceUsd8: price.toString(), externalPriceUsd8: externalPrice.toString(),
    maxDeviationBps: config.maxDeviationBps, maxFeedAgeSeconds: config.maxFeedAgeSeconds,
    // writeReport can succeed without broadcasting. Only an RPC receipt + receiver
    // event verified by the host-side runner can establish public-chain publication.
    reportGenerated: true, published: false, reportWriteSucceeded, reportTransactionHash, encodedReport: encoded,
  };
  runtime.log(`AGENTPAY_RESULT ${JSON.stringify(output)}`);
  return JSON.stringify(output);
}

const initWorkflow = (config: Config) => [cre.handler(new cre.capabilities.CronCapability().trigger({ schedule: config.schedule }), onPaymentCheck)];
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}
