import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  streamView,
  validateStreamForm,
} from '../../vite-project/src/lib/stream-state.mjs';
import { validateEvidence } from '../../vite-project/src/lib/evidence.mjs';

const stream = {
  isActive: true,
  startTime: 100,
  stopTime: 103,
  totalAmount: 10n,
  flowRate: 3n,
  amountWithdrawn: 3n,
};
test('claimable estimates subtract prior withdrawals and release the final integer remainder at expiry', () => {
  assert.equal(streamView(stream, 99).claimable, 0n);
  assert.equal(streamView(stream, 102).claimable, 3n);
  assert.equal(streamView(stream, 103).claimable, 7n);
  assert.equal(streamView(stream, 103).status, 'completed');
  assert.equal(
    streamView({ ...stream, amountWithdrawn: 10n }, 110).claimable,
    0n
  );
  assert.equal(streamView({ ...stream, isActive: false }, 102).claimable, 0n);
});
const form = {
  recipient: '0x0000000000000000000000000000000000000001',
  amount: '1',
  duration: '86400',
  balance: '2',
};
test('stream form validates the actual default duration, balance and exact raw-unit flow rate', () => {
  assert.deepEqual(validateStreamForm(form), {});
  assert.ok(validateStreamForm({ ...form, balance: '0.5' }).amount);
  assert.ok(
    validateStreamForm({ ...form, amount: '0.000000000000000001' }).amount
  );
  for (const duration of ['', '1.5', '1e3', '-1', '0', '9007199254740993'])
    assert.ok(validateStreamForm({ ...form, duration }).duration);
  assert.ok(validateStreamForm({ ...form, recipient: 'agent.eth' }).recipient);
  assert.ok(
    validateStreamForm({
      ...form,
      recipient: '0x0000000000000000000000000000000000000000',
    }).recipient
  );
});
const evidence = JSON.parse(
  readFileSync(
    new URL(
      '../../vite-project/public/evidence/cre-allow.json',
      import.meta.url
    )
  )
);
test('validates current evidence and rejects a mismatched asset, scale or missing price before rendering', () => {
  assert.equal(validateEvidence(evidence, 'allow'), evidence);
  for (const change of [
    { tokenDecimals: 18 },
    { chainId: 1 },
    { externalPriceUsd8: null },
    { chainlinkPriceUsd8: '0' },
    { approved: false },
  ]) {
    assert.throws(() =>
      validateEvidence(
        { ...evidence, result: { ...evidence.result, ...change } },
        'allow'
      )
    );
  }
  assert.throws(() => validateEvidence(evidence, 'deny-budget'));
  assert.throws(() =>
    validateEvidence({ ...evidence, capturedAt: 'invalid' }, 'allow')
  );
});
