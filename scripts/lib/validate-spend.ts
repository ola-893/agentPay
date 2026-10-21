import assert from "node:assert/strict";
import {
  configSchema,
  simulationSchema,
  evaluate,
  digest,
} from "../../cre/payment-guard/spend-policy";
const c = configSchema.parse(JSON.parse(process.argv[2]));
assert.equal(digest(c.intent), c.intentHash);
if (process.argv[3]) {
  const r = JSON.parse(process.argv[3]);
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.type, "spend-review");
  assert.equal(r.source, "local-cre-simulation");
  assert.equal(r.donAuthenticated, false);
  assert.equal(digest(r.intent), c.intentHash);
  assert.equal(r.intentHash, c.intentHash);
  assert.equal(r.intentId, c.intent.id);
  assert.equal(r.observedBlock, c.observationBlock);
  assert.equal(r.blockHash, c.blockHash);
  assert.equal(r.expiresAt, c.intent.expiresAt);
  assert.equal(r.policyVersion, "spend-risk-v1");
  assert.equal(Number.isSafeInteger(r.evaluatedAt), true);
  assert.match(r.chain.balanceRaw, /^(0|[1-9][0-9]*)$/);
  assert.equal(Number.isInteger(r.chain.tokenDecimals), true);
  assert.deepEqual(
    r.decision,
    evaluate(c, simulationSchema.parse(r.simulation), r.chain, r.evaluatedAt)
  );
}
