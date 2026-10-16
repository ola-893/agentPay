import { describe, expect, test } from 'bun:test';
import { configSchema, evaluate, parseUsd8, parseMarketQuote } from './policy';
import raw from './config.staging.json';

const config = configSchema.parse(raw);
const now = 1800000000;
const feed = { price: 100000000n, decimals: 8, updatedAt: now - 30, roundId: 10n, answeredInRound: 10n };

describe('deterministic CRE payment policy', () => {
  test('allows a bounded payment with fresh matching independent prices', () => {
    expect(evaluate(config, feed, 100050000n, now)).toEqual({ approved: true, reason: 'WITHIN_POLICY' });
  });
  test('rejects divergence beyond the exact basis point boundary', () => {
    expect(evaluate(config, feed, 101000000n, now).approved).toBe(true);
    expect(evaluate(config, feed, 101000001n, now).reason).toBe('PRICE_DEVIATION');
  });
  test('rejects stale and future feed observations', () => {
    expect(evaluate(config, { ...feed, updatedAt: now - config.maxFeedAgeSeconds - 1 }, feed.price, now).reason).toBe('FEED_STALE');
    expect(evaluate(config, { ...feed, updatedAt: now + 61 }, feed.price, now).reason).toBe('FUTURE_FEED');
  });
  test('rejects invalid answers and incomplete rounds', () => {
    expect(evaluate(config, { ...feed, price: -1n }, feed.price, now).reason).toBe('INVALID_FEED');
    expect(evaluate(config, { ...feed, answeredInRound: 9n }, feed.price, now).reason).toBe('INVALID_FEED');
    expect(evaluate(config, { ...feed, decimals: 18 }, feed.price, now).reason).toBe('INVALID_FEED');
  });
  test('enforces the requested token-unit spending cap', () => {
    expect(config.request.amount).toBe('10000'); // 0.01 USDC, six decimals
    expect(evaluate(config, feed, feed.price, now).approved).toBe(true);
    const c = { ...config, request: { ...config.request, amount: '100001', spendingCap: '100000' } };
    expect(evaluate(c, feed, feed.price, now).reason).toBe('AMOUNT_EXCEEDS_POLICY');
  });
  test('rejects matching depegged prices above and below $1, including one atomic price unit beyond the boundary', () => {
    for (const price of [99000000n, 101000000n]) expect(evaluate(config, { ...feed, price }, price, now).approved).toBe(true);
    for (const price of [98000000n, 102000000n, 98999999n, 101000001n]) {
      expect(evaluate(config, { ...feed, price }, price, now).reason).toBe('USDC_DEPEG');
    }
  });
  test('checks the peg for each source even when their disagreement is within policy', () => {
    expect(evaluate(config, { ...feed, price: 98999999n }, 99000000n, now).reason).toBe('USDC_DEPEG');
    expect(evaluate(config, { ...feed, price: 99000000n }, 98999999n, now).reason).toBe('USDC_DEPEG');
  });
  test('binds the policy to Circle Sepolia USDC, six decimals and the USDC/USD feed/API', () => {
    for (const change of [{ tokenDecimals: 18 }, { chainId: 1 }, { tokenSymbol: 'tUSD' },
      { priceFeedAddress: '0x694AA1769357215DE4FAC081bf1f309aDC325306' },
      { marketApiUrl: 'https://api.coinbase.com/v2/prices/ETH-USD/spot' },
      { request: { ...raw.request, token: '0x0000000000000000000000000000000000000003' } }]) {
      expect(() => configSchema.parse({ ...raw, ...change })).toThrow();
    }
  });
  test('rejects API quotes for another asset or quote currency', () => {
    expect(parseMarketQuote({ data: { base: 'USDC', currency: 'USD', amount: '1' } })).toBe(100000000n);
    for (const data of [{ base: 'ETH', currency: 'USD', amount: '1' }, { base: 'USDC', currency: 'EUR', amount: '1' }, { base: 'USDC', currency: 'USD', amount: 'NaN' }]) {
      expect(() => parseMarketQuote({ data })).toThrow();
    }
  });
  test('parses decimal prices without floating-point rounding', () => {
    expect(parseUsd8('2000.12345678')).toBe(200012345678n);
    expect(parseUsd8('0.00000001')).toBe(1n);
    for (const s of ['NaN', '-1', '0', '1e3', '1.000000001']) expect(() => parseUsd8(s)).toThrow();
  });
  test('validates addresses, uint256 units, lifetimes, and publication destination', () => {
    expect(() => configSchema.parse({ ...raw, publishReport: true })).toThrow();
    expect(() => configSchema.parse({ ...raw, authorizationTtlSeconds: 7200 })).toThrow();
    expect(() => configSchema.parse({ ...raw, request: { ...raw.request, amount: '-1' } })).toThrow();
  });
});
