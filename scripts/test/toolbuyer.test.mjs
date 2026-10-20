import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
const run = (args) =>
  spawnSync("bun", ["run", "demo/toolbuyer.mjs", ...args], {
    encoding: "utf8",
    timeout: 30000,
  });
test("ToolBuyer help and malformed seeds use one JSON envelope before network or listeners", () => {
  const help = run(["--help", "--json"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(JSON.parse(help.stdout).data.help, /benchmark credits/i);
  for (const args of [
    ["--seeds", "1,1"],
    ["--seeds", "0"],
    ["--seeds", "17,wrong"],
    ["--pay"],
  ]) {
    const r = run([...args, "--json"]);
    assert.equal(r.status, 2, r.stderr);
    assert.equal(JSON.parse(r.stdout).ok, false);
  }
});
test("ToolBuyer held-out benchmark counts trials and every answer, reports the strong baseline honestly", () => {
  const r = run(["--offline", "--seeds", "17,29,43,71,97", "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout).data;
  assert.equal(result.mode, "offline-evaluation");
  assert.equal(result.tokenTransfers, false);
  assert.equal(result.cohorts.length, 15);
  assert.ok(!r.stdout.includes("\u001b"));
  const saved = JSON.parse(
    readFileSync(path.join(result.evidenceDirectory, "result.json"))
  );
  assert.deepEqual(saved, result);
  const uniqueReceipts = new Set(result.ledger.map((r) => r.receiptId));
  assert.equal(uniqueReceipts.size, result.ledger.length);
  for (const row of result.totals) {
    assert.equal(row.tasks, 300);
    const ledgerCost = result.ledger
      .filter((r) => r.account === row.strategy)
      .reduce((s, r) => s + r.costRaw, 0);
    assert.equal(row.totalCostRaw, ledgerCost);
    assert.equal(row.totalCostRaw, row.trialCostRaw + row.serviceCostRaw);
    assert.equal(
      row.utilityRaw,
      row.correct * result.rewardRawPerCorrect - row.totalCostRaw
    );
    if (row.strategy !== "toolbuyer") assert.equal(row.trialCostRaw, 0);
  }
  assert.equal(
    result.visible.find((p) => p.provider === "showcase").correct,
    9
  );
  assert.equal(
    result.totals.find((p) => p.strategy === "fixed-showcase").correct,
    0
  );
  assert.equal(
    result.totals.find((p) => p.strategy === "fixed-expert").correct,
    300
  );
  for (const cohort of result.cohorts) {
    const trials = new Set(
      cohort.selection.observations.map((o) => JSON.stringify(o.task.input))
    );
    assert.ok(
      cohort.heldout.every((t) => !trials.has(JSON.stringify(t.input)))
    );
    const terminal = cohort.selection.decision;
    assert.notEqual(terminal.action, "TRIAL");
    assert.ok(terminal.candidates.every((c) => c.netValueRaw <= 1e-8));
    assert.ok(terminal.spentRaw <= cohort.config.maxTrialSpendRaw);
  }
  assert.match(r.stderr, /fixed-expert/);
});
test("ToolBuyer synthetic providers charge idempotently and reject substituted task reuse", () => {
  const program = `
    import assert from 'node:assert/strict';
    import {startProviders, purchaseUrl, providerAnswer, visibleTasks} from './demo/toolbuyer/providers.mjs';
    import {makeTask, expectedAnswer} from './cre/payment-guard/toolbuyer-policy.ts';
    const service=await startProviders();
    try {
      const task=makeTask('units',17,10000);
      const url=purchaseUrl(service.url,'trial','toolbuyer','budget',task);
      const a=await (await fetch(url)).json(); const b=await (await fetch(url)).json();
      assert.deepEqual(a,b); assert.equal(service.ledger.length,1);
      assert.equal((await fetch(purchaseUrl(service.url,'trial','toolbuyer','budget',{...task,input:{usdc:'1.00'}}))).status,400);
      assert.equal(service.ledger.length,1);
      for(const t of visibleTasks) assert.equal(providerAnswer('showcase',t),expectedAnswer(t));
      for(const family of ['invoice','units','routing']) for(let i=10000;i<10100;i++) {
        const t=makeTask(family,29,i); assert.equal(providerAnswer('expert',t),expectedAnswer(t));
      }
    } finally {await service.close();}
  `;
  const r = spawnSync("bun", ["--eval", program], {
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(r.status, 0, r.stderr);
});
test("ToolBuyer evidence verifier rejects altered labels, costs, provider choices and decision traces", () => {
  const program = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {verifyBenchmark} from './demo/toolbuyer/verify.mjs';
    const original=JSON.parse(readFileSync('docs/evidence/toolbuyer/result.json'));
    verifyBenchmark(original);
    for(const mutate of [
      r=>r.cohorts[0].outcomes[0].answers[0].correct=!r.cohorts[0].outcomes[0].answers[0].correct,
      r=>r.ledger[0].costRaw++,
      r=>r.cohorts[0].outcomes[0].provider='expert',
      r=>r.cohorts[0].selection.trace[0].candidates[0].netValueRaw++,
      r=>r.cohorts[0].heldout[0].input={bad:true},
    ]) {const changed=structuredClone(original);mutate(changed);assert.throws(()=>verifyBenchmark(changed));}
  `;
  const r = spawnSync("bun", ["--eval", program], {
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(r.status, 0, r.stderr);
});
