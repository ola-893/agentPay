// Run with Bun: the exact TypeScript policy is shared with the CRE WASM workflow.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { JsonRpcProvider, FetchRequest, isAddress } from "ethers";
import dotenv from "dotenv";
import cli from "../scripts/lib/cli.cjs";
import { stripAnsi } from "../scripts/lib/cre-evidence.mjs";
import {
  configSchema,
  families,
  providers,
  makeTask,
  grade,
  decide,
  validateReply,
} from "../cre/payment-guard/toolbuyer-policy.ts";
import {
  startProviders,
  providerAnswer,
  visibleTasks,
  purchaseUrl,
} from "./toolbuyer/providers.mjs";
import { verifyPlan, verifyBenchmark } from "./toolbuyer/verify.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const help = `ToolBuyer / task-specific quality purchasing

Usage: npm run --silent demo:toolbuyer -- [--offline] [--seeds 17,29,43] [--json]

Default: real local CRE simulations + Sepolia Circle USDC budget reads.
--offline   Real loopback HTTP providers; policy runs in Bun, NO CRE or chain.
--seeds     Comma-separated unique integers 1..1000000; default 17; maximum 10.
--json      One result envelope on stdout; progress on stderr.
--help      No credentials, network, purchases or listeners.

Three synthetic providers and three task families. Independent Beta(1,1) quality
beliefs; exact one-step expected information value minus trial cost. Trial caps
and budget may also stop evaluation. No claim of globally optimal stopping.
Visible examples are free; paid trials and held-out tasks use disjoint inputs.
All costs are benchmark credits in six-decimal USDC-style raw units, NOT token
transfers. No wallet signing, USDC funding, escrow, model API or DON deployment.
Default CRE path reads AGENTPAY_TOOLBUYER_PAYER or the public demo payer address;
SEPOLIA_RPC_URL is host-side only. Existing demo:agent --pay is the separate real
USDC streaming demo. Evidence: .local/toolbuyer/runs/. Exit 0/1/2 complete/failure/usage.`;
async function request(base, kind, account, provider, task) {
  const response = await fetch(
    purchaseUrl(base, kind, account, provider, task),
    { signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return validateReply(task, provider, await response.json(), kind === "trial");
}
async function localPlan(config) {
  const observations = [],
    trace = [];
  for (let i = 0; i <= 3 * config.maxTrialsPerProvider; i++) {
    const d = decide(config, observations, String(config.budgetRaw));
    trace.push(d);
    if (d.action !== "TRIAL")
      return {
        schemaVersion: 1,
        workflow: "agentpay-toolbuyer",
        mode: "offline-evaluation",
        billingMode: "benchmark-credits",
        config,
        onchain: null,
        decision: d,
        observations,
        trace,
        donAuthenticated: false,
        published: false,
      };
    const n = observations.filter((o) => o.provider === d.provider).length;
    const task = makeTask(config.family, config.seed, 100 + n);
    const r = await request(
      config.serviceUrl,
      "trial",
      "toolbuyer",
      d.provider,
      task
    );
    observations.push({
      task,
      provider: d.provider,
      answer: r.answer,
      costRaw: r.costRaw,
      receiptId: r.receiptId,
    });
  }
  throw new Error("Trial loop exceeded bound");
}
async function crePlan(config, directory, label) {
  const configFile = path.join(directory, `${label}.config.json`),
    logFile = path.join(directory, `${label}.log`);
  const serialized = JSON.stringify(config, null, 2) + "\n";
  await writeFile(configFile, serialized);
  const args = [
    "workflow",
    "simulate",
    "payment-guard",
    "--target",
    "toolbuyer-settings",
    "--trigger-index",
    "0",
    "--non-interactive",
    "--config",
    path.relative(path.join(root, "cre/payment-guard"), configFile),
  ];
  console.log(`  CRE: (cd cre) cre ${args.join(" ")}`);
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /(?:PRIVATE_KEY(?:_\d+)?|API_KEY|OPEN_AI_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN|RPC_URL)$/.test(
        key
      )
    )
      delete env[key];
  const child = await cli.runChild(process.env.CRE_BIN || "cre", args, {
    cwd: path.join(root, "cre"),
    env,
    quiet: true,
    timeoutMs: 180000,
    label: "ToolBuyer CRE",
  });
  const log = stripAnsi(child.output).split(root).join("<repo>");
  await writeFile(logFile, log);
  if (child.code !== 0)
    throw new Error(`CRE failed; see ${path.relative(root, logFile)}`);
  const lines = stripAnsi(child.output).split("\n");
  const marker = lines.findIndex((line) =>
    line.includes("Workflow Simulation Result:")
  );
  if (marker < 0) throw new Error("CRE returned no complete ToolBuyer result");
  const outer = JSON.parse(
    lines.slice(marker + 1).find((line) => line.trim()) || "null"
  );
  const result = typeof outer === "string" ? JSON.parse(outer) : outer;
  assert.equal(result.mode, "local-simulation");
  verifyPlan(config, result);
  await writeFile(
    path.join(directory, `${label}.json`),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        configSha256: createHash("sha256").update(serialized).digest("hex"),
        logSha256: createHash("sha256").update(log).digest("hex"),
        result,
      },
      null,
      2
    ) + "\n"
  );
  return result;
}
await cli.cliMain(
  "demo:toolbuyer",
  { offline: "boolean", seeds: "value" },
  help,
  async ({ flags }) => {
    const input = flags.seeds || "17";
    if (!/^[1-9][0-9]*(,[1-9][0-9]*)*$/.test(input))
      throw new cli.CliError(
        "USAGE",
        "--seeds requires comma-separated positive integers.",
        2
      );
    const seeds = input.split(",").map(Number);
    if (
      seeds.length > 10 ||
      new Set(seeds).size !== seeds.length ||
      seeds.some((s) => !Number.isSafeInteger(s) || s > 1000000)
    )
      throw new cli.CliError(
        "USAGE",
        "Use 1 to 10 unique seeds, each at most 1000000.",
        2
      );
    dotenv.config({ path: path.join(root, ".env"), quiet: true });
    const payer =
      process.env.AGENTPAY_TOOLBUYER_PAYER ||
      "0xe26468ae02368a75DBDBea58F367B7313942ad26";
    if (!isAddress(payer))
      throw new cli.CliError("CONFIG", "Invalid AGENTPAY_TOOLBUYER_PAYER.", 2);
    const directory = path.join(
      root,
      ".local/toolbuyer/runs",
      new Date().toISOString().replace(/[-:.]/g, "").slice(0, 16) +
        "-" +
        randomBytes(3).toString("hex")
    );
    await mkdir(directory, { recursive: true });
    let rpc, service;
    try {
      let observationBlock = 1;
      if (!flags.offline) {
        const transport = new FetchRequest(
          process.env.SEPOLIA_RPC_URL ||
            "https://ethereum-sepolia-rpc.publicnode.com"
        );
        transport.timeout = 15000;
        rpc = new JsonRpcProvider(transport, undefined, {
          batchMaxCount: 1,
          cacheTimeout: -1,
        });
        if ((await rpc.getNetwork()).chainId !== 11155111n)
          throw new Error("ToolBuyer requires Sepolia");
        observationBlock = await rpc.getBlockNumber();
      }
      service = await startProviders();
      console.log(
        `\n  ToolBuyer / ${
          flags.offline
            ? "OFFLINE POLICY EVALUATION (no CRE/chain)"
            : "LOCAL CRE + SEPOLIA READS"
        }`
      );
      console.log(
        "  Synthetic providers; benchmark credits only. No token transfers or wallet signing."
      );
      const visible = providers.map((p) => ({
        provider: p.id,
        correct: visibleTasks.filter((t) => grade(t, providerAnswer(p.id, t)))
          .length,
        tasks: visibleTasks.length,
        costRaw: 0,
      }));
      console.log(
        "  Visible examples (free): " +
          visible
            .map((p) => `${p.provider} ${p.correct}/${p.tasks}`)
            .join(" | ")
      );
      const cohorts = [],
        scoreRows = [];
      for (const seed of seeds)
        for (const family of families) {
          const config = configSchema.parse({
            seed,
            family,
            batchSize: 20,
            rewardRaw: 1000,
            budgetRaw: 20000,
            maxTrialSpendRaw: 2000,
            maxTrialsPerProvider: 12,
            serviceUrl: service.url,
            payer,
            token: USDC,
            observationBlock,
          });
          const trialStart = service.ledger.length;
          const selected = flags.offline
            ? await localPlan(config)
            : await crePlan(config, directory, `${seed}-${family}`);
          verifyPlan(config, selected);
          if (selected.onchain)
            console.log(
              `  CRE read: Circle USDC ${selected.onchain.tokenDecimals} decimals; balance ${selected.onchain.balanceRaw} raw at Sepolia block ${selected.onchain.observationBlock}`
            );
          for (const [i, o] of selected.observations.entries()) {
            const candidate = selected.trace[i].candidates.find(
              (p) => p.provider === o.provider
            );
            console.log(
              `  Trial ${i + 1}: ${o.provider}, ${
                grade(o.task, o.answer) ? "correct" : "incorrect"
              }; cost ${
                o.costRaw
              }; expected gross value ${candidate.grossValueRaw.toFixed(
                2
              )} / net ${candidate.netValueRaw.toFixed(2)} raw`
            );
          }
          assert.equal(
            service.ledger.slice(trialStart).reduce((s, r) => s + r.costRaw, 0),
            selected.decision.spentRaw,
            "Actual trial ledger must reconcile"
          );
          console.log(
            `\n  ${seed}/${family}: ${selected.decision.action} ${
              selected.decision.provider || "none"
            }; trials ${selected.observations.length}, cost ${
              selected.decision.spentRaw
            } raw`
          );
          console.log(
            `  Stop: ${
              selected.decision.reason
            }; best remaining trial net value ${
              selected.decision.candidates[0]?.netValueRaw.toFixed(2) ?? "N/A"
            } raw`
          );
          for (const p of selected.decision.stats)
            console.log(
              `  ${p.id.padEnd(9)} posterior quality ${p.mean.toFixed(
                3
              )} / SD ${p.sd.toFixed(3)} (${p.successes}/${p.trials} trials)`
            );
          // No held-out inputs, labels or service outcomes are passed to the selector.
          // Each strategy buys the exact same tasks, and pays for every answer.
          const heldout = Array.from({ length: config.batchSize }, (_, i) =>
            makeTask(family, seed, 10000 + i)
          );
          const trialKeys = new Set(
            [...visibleTasks, ...selected.observations.map((o) => o.task)].map(
              (t) => JSON.stringify({ family: t.family, input: t.input })
            )
          );
          assert.ok(
            heldout.every(
              (t) =>
                !trialKeys.has(
                  JSON.stringify({ family: t.family, input: t.input })
                )
            ),
            "Held-out input leaked into evaluation trials/examples"
          );
          const outcomes = [];
          const balance = BigInt(
            selected.onchain?.balanceRaw || String(config.budgetRaw)
          );
          const eligibleBudgetRaw = Number(
            balance > BigInt(config.budgetRaw)
              ? BigInt(config.budgetRaw)
              : balance
          );
          for (const [strategy, proposedProvider] of [
            ["toolbuyer", selected.decision.provider],
            ["cheapest", "budget"],
            ["fixed-showcase", "showcase"],
            ["fixed-expert", "expert"],
          ]) {
            const trialCostRaw =
              strategy === "toolbuyer" ? selected.decision.spentRaw : 0;
            const price = providers.find(
              (p) => p.id === proposedProvider
            )?.serviceCostRaw;
            const provider =
              price &&
              trialCostRaw + config.batchSize * price <= eligibleBudgetRaw
                ? proposedProvider
                : null;
            const ledgerStart = service.ledger.length,
              answers = [];
            for (const task of heldout) {
              if (!provider) {
                answers.push({
                  taskId: task.id,
                  answer: null,
                  correct: false,
                  costRaw: 0,
                });
                continue;
              }
              const r = await request(
                service.url,
                "service",
                strategy,
                provider,
                task
              );
              answers.push({ ...r, correct: grade(task, r.answer) });
            }
            const correct = answers.filter((a) => a.correct).length,
              serviceCostRaw = answers.reduce((s, a) => s + a.costRaw, 0);
            assert.equal(
              service.ledger
                .slice(ledgerStart)
                .reduce((s, r) => s + r.costRaw, 0),
              serviceCostRaw
            );
            const row = {
              seed,
              family,
              strategy,
              provider,
              tasks: heldout.length,
              correct,
              trialCostRaw,
              serviceCostRaw,
              totalCostRaw: trialCostRaw + serviceCostRaw,
              utilityRaw:
                correct * config.rewardRaw - trialCostRaw - serviceCostRaw,
              answers,
            };
            outcomes.push(row);
            scoreRows.push(row);
          }
          cohorts.push({
            seed,
            family,
            config,
            selection: selected,
            heldout,
            outcomes,
          });
        }
      const totals = [
        "toolbuyer",
        "cheapest",
        "fixed-showcase",
        "fixed-expert",
      ].map((strategy) => {
        const rows = scoreRows.filter((r) => r.strategy === strategy),
          sum = (key) => rows.reduce((s, r) => s + r[key], 0);
        return {
          strategy,
          tasks: sum("tasks"),
          correct: sum("correct"),
          trialCostRaw: sum("trialCostRaw"),
          serviceCostRaw: sum("serviceCostRaw"),
          totalCostRaw: sum("totalCostRaw"),
          utilityRaw: sum("utilityRaw"),
        };
      });
      console.log(
        "\n  Held-out comparison / all trial and service costs included (raw benchmark units)"
      );
      console.log(
        "  Strategy          Correct       Trials   Service     Total    Utility"
      );
      for (const r of totals)
        console.log(
          `  ${r.strategy.padEnd(18)}${`${r.correct}/${r.tasks}`.padEnd(
            12
          )}${String(r.trialCostRaw).padStart(7)}${String(
            r.serviceCostRaw
          ).padStart(10)}${String(r.totalCostRaw).padStart(10)}${String(
            r.utilityRaw
          ).padStart(11)}`
        );
      const result = {
        schemaVersion: 1,
        mode: flags.offline ? "offline-evaluation" : "local-cre-benchmark",
        billingMode: "benchmark-credits",
        rawUnitDecimals: 6,
        tokenTransfers: false,
        donAuthenticated: false,
        seeds,
        payer,
        visible,
        rewardRawPerCorrect: 1000,
        totals,
        cohorts,
        ledger: service.ledger,
        evidenceDirectory: path.relative(root, directory),
        limits: [
          "Synthetic deterministic providers, not LLM/provider quality claims",
          "One-step EVSI stopping is myopic, not globally optimal",
          "Independent stationary Bernoulli beliefs are modeling assumptions",
          "Visible examples are free; all executed trials and held-out calls are charged benchmark credits",
          "No escrow or token settlement; onchain USDC balance is budget eligibility only",
          "Trial/held-out separation prevents selection leakage, not provider access to public benchmark source",
        ],
      };
      verifyBenchmark(result);
      await writeFile(
        path.join(directory, "result.json"),
        JSON.stringify(result, null, 2) + "\n"
      );
      console.log(`\n  Evidence: ${result.evidenceDirectory}/result.json\n`);
      return result;
    } catch (error) {
      await writeFile(
        path.join(directory, "failure.json"),
        JSON.stringify(
          { message: cli.redact(error.message), ledger: service?.ledger || [] },
          null,
          2
        ) + "\n"
      );
      throw error;
    } finally {
      await service?.close();
      rpc?.destroy();
    }
  }
);
