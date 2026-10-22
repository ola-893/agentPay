import { appendFileSync } from "node:fs";
import path from "node:path";
import cli from "../../scripts/lib/cli.cjs";
import { validateEvent } from "../../vite-project/src/lib/run-events.mjs";
export function createRunEvents({ runId, directory, ndjson = false }) {
  let seq = 0,
    transportBroken = false;
  if (ndjson)
    process.stdout.on("error", () => {
      transportBroken = true;
    });
  return (type, data) => {
    const e = validateEvent(
      JSON.parse(
        cli.redact(
          JSON.stringify({
            schemaVersion: 1,
            runId,
            seq: ++seq,
            at: new Date().toISOString(),
            type,
            data,
          })
        )
      )
    );
    const line = JSON.stringify(e) + "\n";
    appendFileSync(path.join(directory, "run.ndjson"), line, { mode: 0o600 });
    if (ndjson && !transportBroken) {
      try {
        process.stdout.write(line);
      } catch {
        transportBroken = true;
      }
    }
    return e;
  };
}
export function eventOutput(output, emit, profile) {
  let invocation;
  return new Proxy(output, {
    get(target, key) {
      const original = target[key];
      if (typeof original !== "function") return original;
      return (...args) => {
        const value = args[0];
        if (key === "start")
          emit("run.start", {
            mode: output.payMode || "preview",
            profile,
            planner: `${value.settings.provider} / ${value.settings.model}`,
            payer: value.payer,
            recipient: value.recipient,
            balances: {
              payerUsdcRaw: value.balanceRaw,
              payerEthRaw: value.ethBalanceRaw,
            },
          });
        if (key === "thinking")
          emit("step.start", {
            label: value
              ? "Agent summarizing verified results"
              : "Agent planning next request",
            stage: "planner",
          });
        if (key === "requested")
          emit("step.start", {
            label: `${value.tier} service request`,
            stage: "request",
            tier: value.tier,
          });
        if (key === "creInvocation") {
          invocation = {
            ...value,
            command: ["cre", ...value.command.slice(1)].join(" "),
          };
          emit("step.start", {
            label: "Running local CRE simulation",
            stage: "cre",
            ...invocation,
          });
        }
        if (key === "priceEvidence" || key === "streamEvidence") {
          const r = value.result;
          emit("cre.result", {
            target: key === "priceEvidence" ? "price" : "stream",
            command: invocation.command,
            cwd: invocation.cwd,
            configPath: invocation.configPath,
            transcriptPath: invocation.transcriptPath,
            observations: r,
            decision: r.action || (r.approved ? "ALLOW" : "DENY"),
            reason: r.reason,
            hostCheck: true,
            source: "local-cre-simulation",
          });
        }
        if (key === "streamRequests")
          emit("api.reuse", {
            ...value,
            streamId: String(args[1]),
            ...args[2],
          });
        if (key === "streamOutage")
          emit("fault", { label: "Injected provider outage", httpStatus: 503 });
        if (key === "streamOpened")
          emit("stream.opened", {
            streamId: value.streamId,
            fundedRaw: value.fundedRaw,
          });
        if (key === "streamClosed")
          emit("stream.closed", {
            streamId: value.streamId,
            earnedRaw: value.earnedRaw,
            refundedRaw: value.refundedRaw,
          });
        return original.apply(target, args);
      };
    },
  });
}
export function runSummary(result, status = "completed") {
  const b = result.purchases?.basic;
  return {
    status,
    fundedRaw: result.fundedRaw || "0",
    earnedRaw: result.earnedRaw || "0",
    refundedRaw: result.refundedRaw || "0",
    balances: { before: result.initial || {}, after: result.final || {} },
    transactions: [
      ...(b?.funded?.transactions || []).map((t) => ({
        kind: t === b.funded.transactions.at(-1) ? "open" : "approval",
        hash: t.transactionHash,
      })),
      ...(b?.settlement?.transaction
        ? [{ kind: "close", hash: b.settlement.transaction.transactionHash }]
        : []),
    ],
    donAuthenticated: false,
  };
}
