import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  LocalJournal,
  digest,
  durableWrite,
  merkle,
  leafHash,
  verifyProof,
} from "../../demo/audit/journal.mjs";
const intent = {
  id: "0x" + "1".repeat(64),
  payer: "0x0000000000000000000000000000000000000001",
};
const record = {
  intentId: intent.id,
  intentHash: digest(intent),
  decision: { action: "BLOCK", reason: "TEST" },
};
test("durable blobs are immutable, content addressed and detect tampering", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "audit-blobs-"));
  try {
    const j = await new LocalJournal(dir).init();
    await j.accept(intent);
    const p = await j.commit(record);
    assert.equal(p.blobHash, digest(record));
    await j.commit(record);
    await assert.rejects(
      j.commit({ ...record, decision: { action: "ALLOW" } }),
      /conflict/
    );
    // Conflicting orphan decisions are deliberately not auto-selected on recovery.
    await assert.rejects(j.recover(), /conflict/);
    await writeFile(
      j.file("blobs", p.blobHash),
      JSON.stringify({ ...record, decision: { action: "ALLOW" } })
    );
    await assert.rejects(j.blob(p.blobHash), /integrity/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("recovery repairs the blob/pointer crash window and reports undecided intents", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "audit-recovery-"));
  try {
    const j = await new LocalJournal(dir).init();
    await j.accept(intent);
    await durableWrite(j.file("blobs", digest(record)), record, true);
    const pending = { ...intent, id: "0x" + "2".repeat(64) };
    await j.accept(pending);
    const state = await j.recover();
    assert.equal(state.entries.length, 1);
    assert.deepEqual(state.pendingIntents, [pending.id]);
    assert.equal((await j.status()).pendingReceipts.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Merkle proofs bind every decision and fail for changed data or receipt domains", () => {
  const domain = {
    chainId: 11155111,
    address: "0x0000000000000000000000000000000000000002",
    writer: intent.payer,
  };
  const entries = [1, 2, 3].map((n) => ({
    sequence: n,
    intentId: "0x" + String(n).repeat(64),
    blobHash: digest({ ...record, n }),
  }));
  const leaves = entries.map((e) => leafHash(domain, e)),
    tree = merkle(leaves);
  for (let n = 0; n < 3; n++) {
    assert.equal(verifyProof(leaves[n], tree.proofs[n], tree.root), true);
    assert.equal(
      verifyProof(
        leafHash({ ...domain, chainId: 1 }, entries[n]),
        tree.proofs[n],
        tree.root
      ),
      false
    );
  }
});
test("spend-review CLI help and incompatible resume flags need no wallet or RPC", () => {
  const run = (args) =>
    spawnSync("bun", ["run", "demo/spend-review.mjs", ...args], {
      encoding: "utf8",
      timeout: 30000,
    });
  const help = run(["--help", "--json"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(JSON.parse(help.stdout).data.help, /No payment signed/);
  const bad = run(["--resume", "--json"]);
  assert.equal(bad.status, 2, bad.stderr);
  assert.equal(JSON.parse(bad.stdout).error.code, "USAGE");
});
test("real local RPC reviews ALLOW/BLOCK/ERROR, anchors every decision, gates signing and reconciles USDC", () => {
  const r = spawnSync(
    "bun",
    ["run", "scripts/test/fixtures/audit-scenario.mjs"],
    { encoding: "utf8", timeout: 90000 }
  );
  assert.equal(r.status, 0, r.stderr + "\n" + r.stdout);
  assert.match(r.stdout, /audit scenario passed/);
});
