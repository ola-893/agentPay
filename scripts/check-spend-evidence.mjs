import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  LocalJournal,
  digest,
  leafHash,
  verifyProof,
} from "../demo/audit/journal.mjs";
import {
  configSchema,
  simulationSchema,
  evaluate,
} from "../cre/payment-guard/spend-policy.ts";
import { parseSimulationResult } from "./lib/cre-evidence.mjs";
const base = new URL("../docs/evidence/spend-review/", import.meta.url);
const json = async (name) =>
  JSON.parse(await readFile(new URL(name, base), "utf8"));
const manifest = await json("manifest.json"),
  journal = new LocalJournal(base.pathname);
assert.equal(manifest.donAuthenticated, false);
assert.equal(manifest.tokenTransfers, false);
assert.deepEqual(
  (await journal.entries()).sort((a, b) =>
    a.intentId.localeCompare(b.intentId)
  ),
  manifest.entries
);
const seen = new Set();
for (const batch of manifest.batches) {
  assert.deepEqual(await json(`batches/${batch.root}.json`), batch);
  assert.equal(batch.state, "anchored");
  for (const entry of batch.entries) {
    assert.ok(!seen.has(entry.intentId));
    seen.add(entry.intentId);
    assert.ok(verifyProof(leafHash(batch, entry), entry.proof, batch.root));
    const pointer = manifest.entries.find((e) => e.intentId === entry.intentId);
    assert.equal(pointer.blobHash, entry.blobHash);
  }
}
assert.equal(seen.size, manifest.entries.length);
for (const run of manifest.runs) {
  const configBytes = await readFile(new URL(run.config, base)),
    log = await readFile(new URL(run.transcript, base), "utf8");
  assert.equal(
    createHash("sha256").update(configBytes).digest("hex"),
    run.configSha256
  );
  assert.equal(createHash("sha256").update(log).digest("hex"), run.logSha256);
  const c = configSchema.parse(JSON.parse(configBytes.toString()));
  const lines = log.split("\n"),
    mark = lines.findIndex((l) => l.includes("Workflow Simulation Result:"));
  assert.ok(mark >= 0);
  const outer = JSON.parse(lines.slice(mark + 1).find((l) => l.trim()));
  const result = typeof outer === "string" ? JSON.parse(outer) : outer;
  assert.equal(result.workflow, "agentpay-spend-review");
  assert.equal(result.mode, "local-simulation");
  const r = result.record,
    stored = await journal.blob(result.stored.blobHash);
  assert.deepEqual(stored, r);
  assert.equal(digest(r.intent), c.intentHash);
  assert.equal(r.intentId, run.intentId);
  assert.deepEqual(
    r.decision,
    evaluate(
      c,
      simulationSchema.parse(r.simulation),
      r.chain,
      r.evaluatedAt ?? r.intent.createdAt
    )
  );
}
const priceEntries = [];
for (const entry of manifest.entries) {
  const r = await journal.blob(entry.blobHash);
  assert.equal(r.intentHash, digest(await journal.intent(entry.intentId)));
  if (r.type === "policy-decision") priceEntries.push(r);
}
assert.equal(priceEntries.length, 1);
assert.equal(priceEntries[0].decision.action, "BLOCK");
assert.equal(priceEntries[0].evidence.reason, "FEED_STALE");
assert.deepEqual(
  parseSimulationResult(await readFile(new URL("cre-price.log", base), "utf8")),
  priceEntries[0].evidence
);
const rpc = await json("rpc-verification.json");
assert.equal(rpc.runtimeCodeMatchesDeployment, true);
assert.equal(rpc.receipts.length, manifest.batches.length);
for (const b of manifest.batches) {
  const r = rpc.receipts.find((r) => r.transactionHash === b.transactionHash);
  assert.equal(r.root, b.root);
  assert.equal(r.count, b.entries.length);
  assert.equal(r.status, 1);
}
console.log(
  "Verified historical spend blobs, original CRE transcript/config hashes, decisions, all Merkle proofs, stale-feed BLOCK and saved public receipt consistency. No fresh CRE run or RPC verification performed."
);
