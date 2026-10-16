import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTokenUnits } from '../../vite-project/src/lib/token-units.mjs';

test('renders guarded USDC raw units exactly at six decimals', () => {
  for (const [raw, display] of [['10000', '0.01'], ['100000', '0.1'], ['200000', '0.2'], ['1', '0.000001'], ['0', '0']]) {
    assert.equal(formatTokenUnits(raw, 6), display);
  }
});
test('does not round large integer balances through floating point', () => {
  assert.equal(formatTokenUnits('9007199254740993123456', 6), '9007199254740993.123456');
  assert.equal(formatTokenUnits('10000000000000000', 18), '0.01');
  assert.throws(() => formatTokenUnits('-1', 6));
  assert.throws(() => formatTokenUnits('1', undefined));
});
