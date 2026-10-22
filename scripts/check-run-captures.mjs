import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { validateRun } from "../vite-project/src/lib/run-events.mjs";
function parseSimulationResult(text) {
  const lines = text.split("\n");
  const at = lines.findIndex((s) => s.includes("Workflow Simulation Result:"));
  if (at < 0) throw new Error("Missing original CRE result");
  const outer = JSON.parse(lines.slice(at + 1).find((s) => s.trim()));
  return typeof outer === "string" ? JSON.parse(outer) : outer;
}
const root = fileURLToPath(
  new URL("../vite-project/public/runs/", import.meta.url)
);
const manifest = JSON.parse(
  await readFile(path.join(root, "index.json"), "utf8")
);
assert.equal(manifest.schemaVersion, 1);
const ids = new Set();
let decisions = 0;
for (const item of manifest.runs) {
  assert.match(item.id, /^[a-zA-Z0-9-]+$/);
  assert.ok(!ids.has(item.id));
  ids.add(item.id);
  assert.equal(item.file, `${item.id}/events.ndjson`);
  const text = await readFile(path.join(root, item.file), "utf8");
  assert.equal(createHash("sha256").update(text).digest("hex"), item.sha256);
  const events = validateRun(
    text
      .trim()
      .split("\n")
      .map((s) => JSON.parse(s))
  );
  assert.equal(events[0].runId, item.id);
  assert.equal(events[0].data.mode, item.mode);
  for (const e of events.filter((e) => e.type === "cre.result")) {
    assert.equal(e.data.hostCheck, true);
    assert.equal(e.data.source, "local-cre-simulation");
    const map = item.artifacts[e.data.transcriptPath];
    assert.match(map, /^artifacts\/[a-zA-Z0-9_.-]+$/);
    const result = parseSimulationResult(
      await readFile(path.join(root, item.id, map), "utf8")
    );
    assert.deepEqual(
      e.data.observations,
      e.data.target === "spend" ? result.record : result
    );
    const config = item.artifacts[e.data.configPath];
    assert.match(config, /^artifacts\/[a-zA-Z0-9_.-]+$/);
    JSON.parse(await readFile(path.join(root, item.id, config), "utf8"));
    decisions++;
  }
  const summary = events.at(-1).data;
  if (item.mode === "preview") {
    assert.equal(summary.fundedRaw, "0");
    assert.equal(
      events.some((e) => ["wallet.tx", "audit.receipt"].includes(e.type)),
      false
    );
  } else {
    assert.ok(BigInt(summary.fundedRaw) <= 10000n);
    assert.equal(
      BigInt(summary.earnedRaw) + BigInt(summary.refundedRaw),
      BigInt(summary.fundedRaw)
    );
    const confirmed = new Set(
      events
        .filter((e) => e.type === "wallet.tx" && e.data.status === "confirmed")
        .map((e) => e.data.hash)
    );
    assert.deepEqual(
      new Set(summary.transactions.map((t) => t.hash)),
      confirmed
    );
    assert.equal(
      BigInt(summary.balances.before.agentBalanceRaw) -
        BigInt(summary.balances.after.agentBalanceRaw),
      BigInt(summary.earnedRaw)
    );
    assert.equal(
      BigInt(summary.balances.after.recipientBalanceRaw) -
        BigInt(summary.balances.before.recipientBalanceRaw),
      BigInt(summary.earnedRaw)
    );
  }
  if (item.preset)
    assert.ok(
      events.some(
        (e) =>
          e.type === "cre.result" &&
          e.data.reason ===
            (item.preset === "tiny-cap"
              ? "AMOUNT_EXCEEDS_POLICY"
              : "FEED_STALE")
      )
    );
}
console.log(
  `Verified ${ids.size} recorded CLI event streams, ${decisions} original CRE results/transcripts, hashes and summary accounting. Historical evidence only; no new CLI or chain calls.`
);
