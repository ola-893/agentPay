import { isAddress, zeroAddress } from 'viem';
import { z } from 'zod';

const party = z.string().refine(s => isAddress(s) && s.toLowerCase() !== zeroAddress, 'Expected a nonzero EVM address');
const units = z.string().regex(/^[1-9][0-9]*$/).refine(s => BigInt(s) < 2n ** 256n, 'Amount exceeds uint256');
export const configSchema = z.object({
  schedule: z.string().min(1),
  chainName: z.literal('ethereum-testnet-sepolia'),
  chainId: z.literal(11155111),
  priceFeedAddress: party,
  marketApiUrl: z.literal('https://api.coinbase.com/v2/prices/ETH-USD/spot'),
  maxFeedAgeSeconds: z.number().int().min(60).max(86400),
  maxDeviationBps: z.number().int().min(1).max(1000),
  authorizationTtlSeconds: z.number().int().min(30).max(900),
  request: z.object({
    requestId: z.string().regex(/^0x[0-9a-fA-F]{64}$/).refine(s => BigInt(s) !== 0n),
    agent: party, recipient: party, token: party, amount: units, spendingCap: units,
  }),
  receiverAddress: z.string().refine((s): boolean => isAddress(s)),
  publishReport: z.boolean(),
}).refine(c => !c.publishReport || c.receiverAddress.toLowerCase() !== zeroAddress, 'Publishing requires a deployed guard');

export type Config = z.infer<typeof configSchema>;
export type Observation = { price: bigint; decimals: number; updatedAt: number; roundId: bigint; answeredInRound: bigint };

export function parseUsd8(value: string): bigint {
  if (!/^[0-9]+(\.[0-9]{1,8})?$/.test(value)) throw new Error('Invalid USD quote');
  const [whole, fraction = ''] = value.split('.');
  const scaled = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  if (scaled <= 0n || scaled >= 2n ** 192n) throw new Error('Invalid USD quote');
  return scaled;
}

export function evaluate(config: Config, feed: Observation, marketPrice: bigint, now: number) {
  const fail = (reason: string) => ({ approved: false, reason });
  if (feed.price <= 0n || feed.decimals !== 8 || feed.roundId <= 0n || feed.answeredInRound < feed.roundId || feed.updatedAt <= 0) return fail('INVALID_FEED');
  if (feed.updatedAt > now + 60) return fail('FUTURE_FEED');
  if (now - feed.updatedAt > config.maxFeedAgeSeconds) return fail('FEED_STALE');
  if (marketPrice <= 0n) return fail('INVALID_MARKET_QUOTE');
  const difference = marketPrice > feed.price ? marketPrice - feed.price : feed.price - marketPrice;
  if (difference * 10000n > feed.price * BigInt(config.maxDeviationBps)) return fail('PRICE_DEVIATION');
  if (BigInt(config.request.amount) > BigInt(config.request.spendingCap)) return fail('AMOUNT_EXCEEDS_POLICY');
  return { approved: true, reason: 'WITHIN_POLICY' };
}
