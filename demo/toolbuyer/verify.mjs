import assert from "node:assert/strict";
import {
  configSchema,
  plan,
  makeTask,
  grade,
  validateReply,
  providers,
} from "../../cre/payment-guard/toolbuyer-policy.ts";
export function verifyPlan(config, result) {
  assert.equal(result.workflow, "agentpay-toolbuyer");
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.billingMode, "benchmark-credits");
  assert.deepEqual(result.config, config);
  if (!["local-simulation", "offline-evaluation"].includes(result.mode))
    throw new Error("Wrong execution mode");
  if (result.mode === "local-simulation") {
    assert.equal(result.onchain.tokenDecimals, 6);
    assert.equal(result.onchain.observationBlock, config.observationBlock);
    assert.match(result.onchain.balanceRaw, /^(0|[1-9][0-9]*)$/);
  } else assert.equal(result.onchain, null);
  let cursor = 0;
  const expected = plan(
    config,
    result.onchain?.balanceRaw || String(config.budgetRaw),
    (task, provider) => {
      const o = result.observations[cursor++];
      assert.ok(o, "Missing trial observation");
      assert.deepEqual(o.task, task);
      assert.equal(o.provider, provider);
      return {
        taskId: task.id,
        provider,
        answer: o.answer,
        costRaw: o.costRaw,
        receiptId: o.receiptId,
        billingMode: "benchmark-credits",
      };
    }
  );
  assert.equal(cursor, result.observations.length);
  assert.deepEqual(expected.decision, result.decision);
  assert.deepEqual(expected.trace, result.trace);
  assert.equal(result.donAuthenticated, false);
  assert.equal(result.published, false);
}
export function verifyBenchmark(result) {
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.billingMode, "benchmark-credits");
  assert.equal(result.tokenTransfers, false);
  assert.equal(result.donAuthenticated, false);
  assert.ok(
    ["offline-evaluation", "local-cre-benchmark"].includes(result.mode)
  );
  assert.equal(result.cohorts.length, result.seeds.length * 3);
  const used = new Map(),
    cohortKeys = new Set();
  const add = (account, kind, taskId, provider, costRaw, receiptId) => {
    assert.ok(!used.has(receiptId), "Receipt reused across purchases");
    used.set(receiptId, {
      account,
      kind,
      taskId,
      provider,
      costRaw,
      receiptId,
    });
  };
  const rows = [];
  for (const cohort of result.cohorts) {
    const c = configSchema.parse(cohort.config);
    assert.equal(cohort.seed, c.seed);
    assert.equal(cohort.family, c.family);
    assert.ok(result.seeds.includes(c.seed));
    const k = `${c.seed}-${c.family}`;
    assert.ok(!cohortKeys.has(k));
    cohortKeys.add(k);
    verifyPlan(c, cohort.selection);
    assert.equal(
      cohort.selection.mode,
      result.mode === "local-cre-benchmark"
        ? "local-simulation"
        : "offline-evaluation"
    );
    const tasks = Array.from({ length: c.batchSize }, (_, i) =>
      makeTask(c.family, c.seed, 10000 + i)
    );
    assert.deepEqual(cohort.heldout, tasks);
    const evaluationInputs = new Set(tasks.map((t) => JSON.stringify(t.input)));
    for (const o of cohort.selection.observations) {
      assert.ok(!evaluationInputs.has(JSON.stringify(o.task.input)));
      add("toolbuyer", "trial", o.task.id, o.provider, o.costRaw, o.receiptId);
    }
    assert.deepEqual(
      cohort.outcomes.map((r) => r.strategy),
      ["toolbuyer", "cheapest", "fixed-showcase", "fixed-expert"]
    );
    for (const r of cohort.outcomes) {
      const balance = BigInt(
        cohort.selection.onchain?.balanceRaw || String(c.budgetRaw)
      );
      const available = Number(
        balance > BigInt(c.budgetRaw) ? BigInt(c.budgetRaw) : balance
      );
      const expectedProvider = {
        toolbuyer: cohort.selection.decision.provider,
        cheapest: "budget",
        "fixed-showcase": "showcase",
        "fixed-expert": "expert",
      }[r.strategy];
      const price = providers.find(
        (p) => p.id === expectedProvider
      )?.serviceCostRaw;
      const trialCost =
        r.strategy === "toolbuyer" ? cohort.selection.decision.spentRaw : 0;
      assert.equal(
        r.provider,
        price && trialCost + c.batchSize * price <= available
          ? expectedProvider
          : null
      );
      assert.equal(r.tasks, tasks.length);
      assert.equal(r.answers.length, tasks.length);
      assert.equal(r.family, c.family);
      assert.equal(r.seed, c.seed);
      let correct = 0,
        serviceCost = 0;
      for (const [i, answer] of r.answers.entries()) {
        assert.equal(answer.taskId, tasks[i].id);
        if (r.provider) {
          validateReply(
            tasks[i],
            r.provider,
            Object.fromEntries(
              Object.entries(answer).filter(([key]) => key !== "correct")
            ),
            false
          );
          assert.equal(answer.correct, grade(tasks[i], answer.answer));
          correct += Number(answer.correct);
          serviceCost += answer.costRaw;
          add(
            r.strategy,
            "service",
            answer.taskId,
            r.provider,
            answer.costRaw,
            answer.receiptId
          );
        } else {
          assert.equal(answer.costRaw, 0);
          assert.equal(answer.answer, null);
          assert.equal(answer.correct, false);
        }
      }
      assert.equal(r.correct, correct);
      assert.equal(r.serviceCostRaw, serviceCost);
      assert.equal(
        r.trialCostRaw,
        r.strategy === "toolbuyer" ? cohort.selection.decision.spentRaw : 0
      );
      assert.equal(r.totalCostRaw, r.trialCostRaw + serviceCost);
      assert.equal(c.rewardRaw, result.rewardRawPerCorrect);
      assert.equal(r.utilityRaw, correct * c.rewardRaw - r.totalCostRaw);
      rows.push(r);
    }
  }
  assert.equal(result.ledger.length, used.size);
  for (const r of result.ledger) {
    assert.deepEqual(r, used.get(r.receiptId));
    used.delete(r.receiptId);
  }
  assert.equal(used.size, 0);
  assert.deepEqual(
    result.totals.map((r) => r.strategy),
    ["toolbuyer", "cheapest", "fixed-showcase", "fixed-expert"]
  );
  for (const total of result.totals) {
    for (const field of [
      "tasks",
      "correct",
      "trialCostRaw",
      "serviceCostRaw",
      "totalCostRaw",
      "utilityRaw",
    ])
      assert.equal(
        total[field],
        rows
          .filter((r) => r.strategy === total.strategy)
          .reduce((s, r) => s + r[field], 0)
      );
  }
}
