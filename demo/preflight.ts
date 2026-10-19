import { ethers } from 'ethers';
const { CliError } = require('../scripts/lib/cli.cjs');

export function legacyConfig(requireKey = false) {
  const address = (name: string) => {
    const value = process.env[name] || '';
    if (!ethers.isAddress(value) || value === ethers.ZeroAddress)
      throw new CliError('CONFIG', `${name} must be a nonzero EVM address.`, 2);
    return value;
  };
  let key = process.env.PRIVATE_KEY_1 || '';
  if (requireKey) {
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key))
      throw new CliError(
        'CONFIG',
        'PRIVATE_KEY_1 must contain a valid dedicated test-wallet private key.',
        2
      );
    if (!key.startsWith('0x')) key = '0x' + key;
    try {
      new ethers.Wallet(key);
    } catch {
      throw new CliError(
        'CONFIG',
        'PRIVATE_KEY_1 is not a valid signing key.',
        2
      );
    }
  }
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    'https://ethereum-sepolia-rpc.publicnode.com';
  try {
    if (!['http:', 'https:'].includes(new URL(rpcUrl).protocol))
      throw new Error();
  } catch {
    throw new CliError('CONFIG', 'SEPOLIA_RPC_URL must be an HTTP(S) URL.', 2);
  }
  const config = {
    rpcUrl,
    key,
    stream: address('AGENTPAY_STREAM_ADDRESS'),
    token: address('PAYMENT_TOKEN_ADDRESS'),
    recipient: address('PAYMENT_RECIPIENT_ADDRESS'),
  };
  if (config.recipient.toLowerCase() === config.token.toLowerCase())
    throw new CliError(
      'CONFIG',
      'PAYMENT_RECIPIENT_ADDRESS must differ from PAYMENT_TOKEN_ADDRESS.',
      2
    );
  return config;
}
export type LegacyConfig = ReturnType<typeof legacyConfig>;
export function legacyProvider(config: LegacyConfig) {
  const request = new ethers.FetchRequest(config.rpcUrl);
  request.timeout = 5000;
  return new ethers.JsonRpcProvider(request, undefined, { batchMaxCount: 1 });
}
export async function verifyLegacy(
  config: LegacyConfig,
  provider: ethers.JsonRpcProvider
) {
  if ((await provider.getNetwork()).chainId !== 11155111n)
    throw new CliError(
      'WRONG_NETWORK',
      'Legacy demo requires Ethereum Sepolia (chain ID 11155111).'
    );
  for (const [label, target] of [
    ['stream', config.stream],
    ['token', config.token],
  ]) {
    if ((await provider.getCode(target)) === '0x')
      throw new CliError(
        'DEPLOYMENT',
        `Configured ${label} has no deployed bytecode.`
      );
  }
  const token = new ethers.Contract(
    config.token,
    [
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)',
    ],
    provider
  );
  if ((await token.decimals()) !== 18n)
    throw new CliError(
      'TOKEN_UNITS',
      'Legacy demo requires 18-decimal tUSD; six-decimal USDC belongs to the guarded path.'
    );
  const stream = new ethers.Contract(
    config.stream,
    ['function paymentToken() view returns (address)'],
    provider
  );
  if (
    (await stream.paymentToken()).toLowerCase() !== config.token.toLowerCase()
  )
    throw new CliError(
      'TOKEN_BINDING',
      'Configured stream.paymentToken() does not match PAYMENT_TOKEN_ADDRESS.'
    );
  return token;
}
