// Run with Bun; replays the same typed policy without CRE, credentials or RPC.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { verifyBenchmark } from "../demo/toolbuyer/verify.mjs";
const directory = new URL("../docs/evidence/toolbuyer/", import.meta.url);
const load = async (name) =>
  JSON.parse(await readFile(new URL(name, directory), "utf8"));
const recorded = await load("result.json");
verifyBenchmark(recorded);
assert.equal(recorded.mode, "local-cre-benchmark");
for (const cohort of recorded.cohorts) {
  const prefix = `${cohort.seed}-${cohort.family}`;
  const evidence = await load(`${prefix}.json`);
  const config = await readFile(new URL(`${prefix}.config.json`, directory));
  const log = await readFile(new URL(`${prefix}.log`, directory), "utf8");
  assert.equal(
    createHash("sha256").update(config).digest("hex"),
    evidence.configSha256
  );
  assert.equal(
    createHash("sha256").update(log).digest("hex"),
    evidence.logSha256
  );
  assert.deepEqual(JSON.parse(config.toString()), cohort.config);
  const lines = log.split("\n"),
    marker = lines.findIndex((line) =>
      line.includes("Workflow Simulation Result:")
    );
  assert.ok(marker >= 0);
  const outer = JSON.parse(lines.slice(marker + 1).find((line) => line.trim()));
  const result = typeof outer === "string" ? JSON.parse(outer) : outer;
  assert.deepEqual(result, evidence.result);
  assert.deepEqual(result, cohort.selection);
}
const offline = await load("five-seed-offline.json");
verifyBenchmark(offline);
assert.equal(offline.mode, "offline-evaluation");
console.log(
  "Verified ToolBuyer historical CRE transcripts/config hashes, decision traces, held-out grading, trial/service ledgers and five-seed offline totals. No new CRE, chain read or payment was performed."
);
