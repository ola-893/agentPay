import { createHash } from 'node:crypto';
import { cp, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

export const stripAnsi = output => output.replace(/\u001b\[[0-9;]*m/g, '');
export function parseSimulationResult(output) {
  const lines = stripAnsi(output).split('\n');
  const marker = lines.findIndex(line => line.includes('Workflow Simulation Result:'));
  if (marker < 0) throw new Error('No successful CRE result marker');
  for (const line of lines.slice(marker + 1)) {
    if (!line.trim()) continue;
    const outer = JSON.parse(line.trim());
    const result = typeof outer === 'string' ? JSON.parse(outer) : outer;
    if (result?.workflow !== 'agentpay-payment-guard' || result.chainId !== 11155111 || !result.reportGenerated) throw new Error('Unexpected CRE result');
    return result;
  }
  throw new Error('No complete CRE simulation result');
}

export function recordingReadiness(result, scenario, windowSeconds = 600) {
  const expected = scenario === 'allow' ? result.approved === true && result.reason === 'WITHIN_POLICY'
    : result.approved === false && result.reason === 'AMOUNT_EXCEEDS_POLICY';
  const age = result.observedAt - result.feedUpdatedAt;
  const headroom = result.maxFeedAgeSeconds - age;
  const observationsValid = [age, headroom, windowSeconds].every(Number.isSafeInteger) && age >= 0 && windowSeconds > 0;
  return {
    ready: expected && observationsValid && headroom > windowSeconds,
    expectedDecision: expected, feedAgeSeconds: age, freshnessHeadroomSeconds: headroom,
    recordingWindowSeconds: windowSeconds,
    reason: !expected ? `UNEXPECTED_DECISION:${result.reason}` : !observationsValid ? 'INVALID_FRESHNESS_DATA'
      : headroom <= windowSeconds ? 'FEED_NEAR_EXPIRY' : 'READY_AT_DRY_RUN',
  };
}

// Content-addressed backups retain old transcripts before any successful refresh.
export async function backupEvidence(root, scenario) {
  const files = [`docs/evidence/cre-${scenario}.json`, `docs/evidence/cre-${scenario}.log`, `vite-project/public/evidence/cre-${scenario}.json`];
  const { readFile } = await import('node:fs/promises');
  const present = [];
  for (const file of files) {
    try { await access(path.join(root, file)); present.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!present.length) return null;
  const hash = createHash('sha256');
  for (const file of present) hash.update(file).update(await readFile(path.join(root, file)));
  const destination = path.join(root, 'docs/evidence/backups', scenario, hash.digest('hex'));
  for (const file of present) {
    const target = path.join(destination, file);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, file), target, { force: false, errorOnExist: false });
  }
  return destination;
}
