import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { AbiCoder } from 'ethers';
import cli from './cli.cjs';

export async function validateConfig(file, root, result) {
  const check = await cli.runChild(
    'bun',
    [
      fileURLToPath(new URL('./validate-cre-config.ts', import.meta.url)),
      file,
      ...(result ? [JSON.stringify(result)] : []),
    ],
    { cwd: root, quiet: true, label: 'Bun policy validator' }
  );
  if (check.code !== 0)
    throw new cli.CliError(
      result ? 'RESULT_MISMATCH' : 'CONFIG',
      `CRE ${
        result ? 'result' : 'config'
      } validation failed: ${check.output.trim()}`,
      result ? 1 : 2
    );
}
export function validateResult(result, config, write = false) {
  try {
    assert.equal(result.workflow, 'agentpay-payment-guard');
    assert.equal(result.schemaVersion, 2);
    assert.equal(result.mode, write ? 'report-write' : 'simulation-preview');
    assert.equal(result.reportGenerated, true);
    assert.equal(result.published, false);
    assert.equal(result.reportWriteSucceeded, write);
    for (const field of [
      'chainId',
      'chainName',
      'tokenSymbol',
      'tokenDecimals',
      'maxFeedAgeSeconds',
      'maxDeviationBps',
      'maxPegDeviationBps',
      'marketApiUrl',
    ])
      assert.equal(result[field], config[field]);
    assert.equal(result.pricePair, 'USDC/USD');
    assert.equal(result.testnetTokenHasValue, false);
    assert.equal(
      result.feedAddress.toLowerCase(),
      config.priceFeedAddress.toLowerCase()
    );
    assert.equal(
      result.receiverAddress.toLowerCase(),
      config.receiverAddress.toLowerCase()
    );
    for (const field of [
      'requestId',
      'agent',
      'recipient',
      'token',
      'amount',
      'spendingCap',
    ])
      assert.equal(
        result.request[field].toLowerCase(),
        config.request[field].toLowerCase()
      );
    assert.equal(
      Number.isSafeInteger(result.observedAt) && result.observedAt > 0,
      true
    );
    assert.equal(
      result.validUntil,
      result.observedAt + config.authorizationTtlSeconds
    );
    assert.equal(typeof result.approved, 'boolean');
    const decoded = [
      ...AbiCoder.defaultAbiCoder().decode(
        [
          'uint256',
          'address',
          'bytes32',
          'address',
          'address',
          'address',
          'uint256',
          'uint64',
          'bool',
        ],
        result.encodedReport
      ),
    ].map((v) => (typeof v === 'string' ? v.toLowerCase() : v));
    assert.deepEqual(decoded, [
      BigInt(config.chainId),
      config.receiverAddress.toLowerCase(),
      config.request.requestId.toLowerCase(),
      config.request.agent.toLowerCase(),
      config.request.recipient.toLowerCase(),
      config.request.token.toLowerCase(),
      BigInt(config.request.amount),
      BigInt(result.validUntil),
      result.approved,
    ]);
  } catch {
    throw new cli.CliError(
      'RESULT_MISMATCH',
      'CRE output does not match the configured intent, units, policy, destination or encoded report. Evidence was not captured.'
    );
  }
}
