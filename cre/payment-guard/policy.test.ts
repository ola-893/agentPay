import { describe, expect, test } from 'bun:test';
import { configSchema, evaluate, parseUsd8 } from './policy';
import raw from './config.staging.json';

const config = configSchema.parse(raw);
const now = 1800000000;
const feed = { price: 200000000000n, decimals: 8, updatedAt: now - 30, roundId: 10n, answeredInRound: 10n };

describe('deterministic CRE payment policy', () => {
  test('allows a bounded payment with fresh matching independent prices', () => {
    expect(evaluate(config, feed, 201000000000n, now)).toEqual({ approved: true, reason: 'WITHIN_POLICY' });
  });
  test('rejects divergence beyond the exact basis point boundary', () => {
    expect(evaluate(config, feed, 206000000000n, now).approved).toBe(true);
    expect(evaluate(config, feed, 206000000001n, now).reason).toBe('PRICE_DEVIATION');
  });
  test('rejects stale and future feed observations', () => {
    expect(evaluate(config, { ...feed, updatedAt: now - 7201 }, feed.price, now).reason).toBe('FEED_STALE');
    expect(evaluate(config, { ...feed, updatedAt: now + 61 }, feed.price, now).reason).toBe('FUTURE_FEED');
  });
  test('rejects invalid answers and incomplete rounds', () => {
    expect(evaluate(config, { ...feed, price: -1n }, feed.price, now).reason).toBe('INVALID_FEED');
    expect(evaluate(config, { ...feed, answeredInRound: 9n }, feed.price, now).reason).toBe('INVALID_FEED');
    expect(evaluate(config, { ...feed, decimals: 18 }, feed.price, now).reason).toBe('INVALID_FEED');
  });
  test('enforces the requested token-unit spending cap', () => {
    const c = { ...config, request: { ...config.request, amount: '101', spendingCap: '100' } };
    expect(evaluate(c, feed, feed.price, now).reason).toBe('AMOUNT_EXCEEDS_POLICY');
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
