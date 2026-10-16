import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseSimulationResult, recordingReadiness, backupEvidence } from '../lib/cre-evidence.mjs';

const base = { workflow: 'agentpay-payment-guard', chainId: 11155111, reportGenerated: true,
  approved: true, reason: 'WITHIN_POLICY', observedAt: 10000, feedUpdatedAt: 9000, maxFeedAgeSeconds: 7200 };
test('parses the full escaped CLI result after truncated user logs', () => {
  const output = `AGENTPAY_RESULT {truncated}\n✓ Workflow Simulation Result:\n${JSON.stringify(JSON.stringify(base))}\nfinished`;
  assert.deepEqual(parseSimulationResult(output), base);
});
test('does not treat a user log or failed compilation as a successful simulation', () => {
  assert.throws(() => parseSimulationResult(`AGENTPAY_RESULT ${JSON.stringify(base)}`));
  assert.throws(() => parseSimulationResult('Build failed'));
});
test('requires freshness headroom for the full recording window', () => {
  assert.equal(recordingReadiness(base, 'allow').ready, true);
  assert.equal(recordingReadiness({ ...base, feedUpdatedAt: 3400 }, 'allow').reason, 'FEED_NEAR_EXPIRY');
});
test('rejects unexpected outcomes even when the feed is fresh', () => {
  assert.equal(recordingReadiness({ ...base, approved: false, reason: 'PRICE_DEVIATION' }, 'allow').ready, false);
  assert.equal(recordingReadiness(base, 'deny-budget').ready, false);
  assert.equal(recordingReadiness({ ...base, approved: false, reason: 'AMOUNT_EXCEEDS_POLICY' }, 'deny-budget').ready, true);
});
test('rejects stale, future and malformed freshness data', () => {
  for (const change of [{ feedUpdatedAt: 2000 }, { feedUpdatedAt: 10001 }, { maxFeedAgeSeconds: undefined }]) {
    assert.equal(recordingReadiness({ ...base, ...change }, 'allow').ready, false);
  }
});
test('backs up old JSON and transcripts without mutating or overwriting them', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentpay-evidence-'));
  try {
    await mkdir(path.join(root, 'docs/evidence'), { recursive: true });
    await writeFile(path.join(root, 'docs/evidence/cre-allow.log'), 'old transcript');
    const backup = await backupEvidence(root, 'allow');
    assert.equal(await readFile(path.join(backup, 'docs/evidence/cre-allow.log'), 'utf8'), 'old transcript');
    assert.equal(await readFile(path.join(root, 'docs/evidence/cre-allow.log'), 'utf8'), 'old transcript');
    assert.equal(await backupEvidence(root, 'allow'), backup);
  } finally { await rm(root, { recursive: true, force: true }); }
});
