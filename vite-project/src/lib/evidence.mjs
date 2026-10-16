const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
const FEED = '0xa2f78ab2355fe2f984d808b5cee7fd0a93d5270e';
export function validateEvidence(data, scenario) {
  const r = data?.result;
  const units = (value) => typeof value === 'string' && /^[0-9]+$/.test(value);
  const timestamps = [
    r?.observedAt,
    r?.feedUpdatedAt,
    r?.validUntil,
    r?.maxFeedAgeSeconds,
  ];
  if (
    !r ||
    r.workflow !== 'agentpay-payment-guard' ||
    r.schemaVersion !== 2 ||
    r.chainId !== 11155111 ||
    data.scenario !== scenario ||
    data.simulationOnly !== true ||
    !Number.isFinite(Date.parse(data.capturedAt)) ||
    r.tokenSymbol !== 'USDC' ||
    r.tokenDecimals !== 6 ||
    r.request?.token?.toLowerCase?.() !== USDC ||
    r.feedAddress?.toLowerCase?.() !== FEED ||
    r.marketApiUrl !== 'https://api.coinbase.com/v2/prices/USDC-USD/spot' ||
    ![
      r.request?.amount,
      r.request?.spendingCap,
      r.externalPriceUsd8,
      r.chainlinkPriceUsd8,
    ].every(units) ||
    BigInt(r.chainlinkPriceUsd8) <= 0n ||
    BigInt(r.externalPriceUsd8) <= 0n ||
    !timestamps.every(Number.isSafeInteger) ||
    r.validUntil <= r.observedAt ||
    ![r.maxDeviationBps, r.maxPegDeviationBps].every(
      (n) => Number.isInteger(n) && n > 0
    ) ||
    (scenario === 'allow'
      ? r.approved !== true || r.reason !== 'WITHIN_POLICY'
      : r.approved !== false || r.reason !== 'AMOUNT_EXCEEDS_POLICY')
  ) {
    throw new Error(
      'This capture does not match the current Sepolia USDC workflow. Refresh the evidence and try again.'
    );
  }
  return data;
}
export function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
