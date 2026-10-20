import { test, expect } from "bun:test";
import {
  configSchema,
  decide,
  expectedAnswer,
  families,
  makeTask,
  plan,
  validateReply,
  type Config,
} from "./toolbuyer-policy";
const base = configSchema.parse({
  seed: 17,
  family: "units",
  batchSize: 20,
  rewardRaw: 1000,
  budgetRaw: 20000,
  maxTrialSpendRaw: 2000,
  maxTrialsPerProvider: 12,
  serviceUrl: "http://127.0.0.1:1234/run/1234567890abcdef",
  payer: "0xe26468ae02368a75DBDBea58F367B7313942ad26",
  token: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  observationBlock: 100,
});
const reply = (task: any, provider: any, answer: string, i = 0) => ({
  taskId: task.id,
  provider,
  answer,
  costRaw: provider === "budget" ? 30 : provider === "expert" ? 90 : 45,
  receiptId: `receipt-${i}`,
  billingMode: "benchmark-credits",
});
test("ToolBuyer grader has independent integer-unit and constrained-routing vectors", () => {
  expect(
    expectedAnswer({
      id: "i",
      family: "invoice",
      input: {
        lines: [
          { unitRaw: 101, quantity: 3 },
          { unitRaw: 120, quantity: 2 },
        ],
        discountBps: 1250,
      },
    })
  ).toBe("475");
  expect(
    expectedAnswer({ id: "u", family: "units", input: { usdc: "0.000001" } })
  ).toBe("1");
  expect(
    expectedAnswer({ id: "u", family: "units", input: { usdc: "2.010000" } })
  ).toBe("2010000");
  expect(
    expectedAnswer({
      id: "r",
      family: "routing",
      input: {
        routes: [
          { id: "fast", feeRaw: 200, latencyMs: 5 },
          { id: "slow", feeRaw: 1, latencyMs: 20 },
        ],
        maxLatencyMs: 10,
      },
    })
  ).toBe("fast");
  expect(
    expectedAnswer({
      id: "r",
      family: "routing",
      input: { routes: [], maxLatencyMs: 10 },
    })
  ).toBe("NONE");
});
test("ToolBuyer uses Beta uncertainty and exact two-outcome one-step information value", () => {
  const d = decide(base, [], "20000");
  expect(d.action).toBe("TRIAL");
  expect(d.provider).toBe("budget");
  expect(d.stats[0].mean).toBe(0.5);
  expect(d.stats[0].sd).toBeCloseTo(Math.sqrt(1 / 12));
  const candidate = d.candidates.find((c) => c.provider === "budget")!;
  expect(candidate.grossValueRaw).toBeCloseTo(966.6666666667);
  expect(candidate.netValueRaw).toBeCloseTo(936.6666666667);
});
test("ToolBuyer stops when information costs more than its one-step benefit without claiming certainty", () => {
  const task = makeTask("units", 17, 100);
  const d = decide(
    base,
    [
      {
        task,
        provider: "budget",
        answer: expectedAnswer(task),
        costRaw: 30,
        receiptId: "1",
      },
    ],
    "20000"
  );
  expect(d.action).toBe("BUY");
  expect(d.provider).toBe("budget");
  expect(d.reason).toBe("NO_POSITIVE_ONE_STEP_INFORMATION_VALUE");
  expect(d.candidates.every((c) => c.netValueRaw <= 0)).toBe(true);
  expect(d.stats[0].sd).toBeGreaterThan(0.2); // Stopping is economic, not confidence.
});
test("ToolBuyer obeys onchain eligibility, trial spend caps and abstention before buying trials", () => {
  let calls = 0;
  expect(
    plan(base, "0", () => {
      calls++;
    }).decision.action
  ).toBe("ABSTAIN");
  expect(calls).toBe(0);
  expect(
    plan({ ...base, maxTrialSpendRaw: 0 }, "20000", () => {
      calls++;
    }).observations
  ).toHaveLength(0);
  expect(calls).toBe(0);
  expect(decide({ ...base, rewardRaw: 1 }, [], "20000").action).toBe("ABSTAIN");
  const result = plan({ ...base, maxTrialSpendRaw: 30 }, "20000", (t, p) =>
    reply(t, p, "wrong")
  );
  expect(result.decision.spentRaw).toBe(30);
  expect(result.observations).toHaveLength(1);
  expect(
    result.decision.spentRaw +
      20 *
        (result.decision.stats.find((p) => p.id === result.decision.provider)
          ?.serviceCostRaw || 0)
  ).toBeLessThanOrEqual(20000);
});
test("ToolBuyer rejects swapped tasks, providers, raw costs, billing modes and duplicate receipts", () => {
  const t = makeTask("units", 17, 100),
    r = reply(t, "budget", "wrong");
  for (const changes of [
    { taskId: "other" },
    { provider: "expert" },
    { costRaw: 30000000 },
    { billingMode: "USDC-transferred" },
  ])
    expect(() =>
      validateReply(t, "budget", { ...r, ...changes }, true)
    ).toThrow();
  expect(() => plan(base, "20000", (t, p) => reply(t, p, "wrong"))).toThrow(
    "Duplicate trial receipt"
  );
});
test("ToolBuyer task construction separates visible/trial/evaluation inputs for the reported seeds", () => {
  for (const family of families)
    for (const seed of [1, 17, 29, 43, 71, 97]) {
      const input = (t: any) => JSON.stringify(t.input);
      const visible = [0, 1, 2].map((i) => input(makeTask(family, 1, i)));
      const trial = Array.from({ length: 30 }, (_, i) =>
        input(makeTask(family, seed, 100 + i))
      );
      const heldout = Array.from({ length: 20 }, (_, i) =>
        input(makeTask(family, seed, 10000 + i))
      );
      expect(heldout.some((s) => [...visible, ...trial].includes(s))).toBe(
        false
      );
      expect(new Set(heldout).size).toBe(20);
    }
});
test("ToolBuyer schema rejects external provider origins and invalid budget units", () => {
  for (const changes of [
    { serviceUrl: "https://example.com" },
    { maxTrialSpendRaw: -1 },
    { batchSize: 0 },
    { token: "0x0000000000000000000000000000000000000001" },
    { budgetRaw: 0.01 },
  ])
    expect(() => configSchema.parse({ ...base, ...changes })).toThrow();
});
