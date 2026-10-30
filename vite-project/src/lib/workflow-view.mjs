import { formatTokenUnits } from "./token-units.mjs";

export const shortAddress = (value) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
export function formatUsdc(raw) {
  return raw == null ? "—" : `${formatTokenUnits(raw, 6)} USDC`;
}
// Truncate rather than round a displayed balance above what the wallet holds.
export function formatEth(raw) {
  if (raw == null) return "—";
  if (!/^[0-9]+$/.test(String(raw))) throw new Error("Invalid ETH units");
  const digits = (BigInt(raw) / 100000000000000n).toString().padStart(5, "0");
  return `${digits.slice(0, -4)}.${digits.slice(-4)} ETH`;
}
export function toRawUsdc(text) {
  if (text.startsWith(".")) text = "0" + text;
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{0,6})?$/.test(text))
    throw new Error("Use up to 6 decimals.");
  const [whole, fraction = ""] = text.split(".");
  return (
    BigInt(whole) * 1000000n +
    BigInt(fraction.padEnd(6, "0"))
  ).toString();
}
export function formatPrice(raw) {
  if (raw == null) return "—";
  const digits = (BigInt(raw) / 1000n).toString().padStart(6, "0");
  return `${digits.slice(0, -5)}.${digits.slice(-5)}`;
}
export function percentOf(raw, total) {
  if (raw == null || total == null || BigInt(total) <= 0n) return "0%";
  const value = (BigInt(raw) * 10000n) / BigInt(total);
  return `${formatTokenUnits(value > 10000n ? 10000n : value, 2)}%`;
}
export function eventNodes(event) {
  if (
    event.type === "cre.result" ||
    (event.type === "step.start" && event.data.stage === "cre")
  ) {
    const target =
      event.data.target ||
      (event.data.command?.includes("spend-settings")
        ? "spend"
        : event.data.command?.includes("staging-settings")
        ? "price"
        : event.data.command?.includes("stream-settings")
        ? "stream"
        : null);
    if (!target) return ["cre"];
    return target === "price"
      ? ["cre", "agent"]
      : target === "spend"
      ? ["cre", "wallet"]
      : ["cre", "escrow", "service"];
  }
  if (event.type === "wallet.tx")
    return event.data.kind === "approval" ? ["wallet"] : ["wallet", "escrow"];
  if (["stream.opened", "stream.closed"].includes(event.type))
    return ["wallet", "escrow", "service"];
  if (["api.reuse", "fault"].includes(event.type)) return ["agent", "service"];
  if (event.type === "audit.receipt") return ["wallet"];
  if (event.type === "cleanup") return ["wallet", "escrow"];
  return ["agent"];
}
// Presentation projection only. Decisions and amounts are copied from events;
// missing observations remain unknown. This never evaluates a CRE policy.
export function deriveDiagramState(events = []) {
  const state = {
    status: "idle",
    mode: null,
    contractPolicySignatures: false,
    decision: null,
    target: null,
    inputs: [],
    active: [],
    fundedRaw: null,
    earnedRaw: null,
    refundedRaw: null,
    closed: false,
    settlementVerified: false,
    cleanup: null,
    shutdownApproved: false,
    interrupted: false,
    errorCode: null,
    unverified: false,
    notFunded: false,
    successfulRequests: null,
    failedRequests: null,
    reuseTransactions: null,
    service: "unknown",
    faultStatus: null,
    transaction: null,
    transactions: [],
    auditReceipts: [],
    summary: null,
    packet: null,
    lastSeq: 0,
    latestEvent: null,
  };
  const transactions = new Map(),
    receipts = new Map();
  for (const event of events) {
    const d = event.data;
    if (event.type === "run.start") {
      state.contractPolicySignatures = d.contractPolicySignatures === true;
      state.mode = d.mode;
      if (d.mode === "preview") { state.successfulRequests = 0; state.failedRequests = 0; }
    }
    state.status = "running";
    state.lastSeq = event.seq;
    state.latestEvent = event;
    state.active = eventNodes(event);
    state.inputs = [];
    state.packet = null;
    if (event.type === "cre.result") {
      // Keep the lifecycle outcome visible while its ancillary spend review
      // allows submission. A spend block/error must still take precedence.
      if (d.target !== "spend" || !state.decision || d.decision !== "ALLOW") {
        state.decision = d.decision;
        state.target = d.target;
      }
      if (d.target === "stream" && d.observations?.config?.phase === "shutdown")
        state.shutdownApproved = d.decision === "CLOSE" && d.reason === "CLIENT_SHUTDOWN";
      state.inputs =
        d.target === "price"
          ? ["coinbase", "feed"]
          : d.target === "stream"
          ? ["health", "state"]
          : ["state"];
      if (d.target === "stream" && d.observations?.health)
        state.service = d.observations.health.serviceAvailable
          ? "healthy"
          : "outage";
    }
    if (event.type === "wallet.tx") {
      transactions.set(d.hash, d);
      state.transaction = d;
      state.packet = d;
    }
    if (event.type === "stream.opened") state.fundedRaw = d.fundedRaw;
    if (event.type === "stream.closed") {
      state.closed = true;
      state.settlementVerified = true;
      if (state.cleanup) state.cleanup = "closed";
      state.earnedRaw = d.earnedRaw;
      state.refundedRaw = d.refundedRaw;
    }
    if (event.type === "cleanup") state.cleanup = d.status;
    if (event.type === "error") {
      state.errorCode = d.code;
      state.interrupted = d.code === "INTERRUPTED";
    }
    if (event.type === "api.reuse") {
      state.successfulRequests = d.successfulRequests;
      state.failedRequests = d.failedRequests;
      state.reuseTransactions =
        d.hostCheckedNoPaymentTransactions === true &&
        d.walletNonceBefore === d.walletNonceAfter
          ? 0
          : null;
    }
    if (event.type === "fault") {
      state.service = "outage";
      state.faultStatus = d.httpStatus ?? null;
    }
    if (event.type === "audit.receipt") receipts.set(d.hash, d);
    if (event.type === "run.end") {
      state.status = d.status;
      state.summary = d;
      state.notFunded = d.cleanup === "not-funded" && transactions.size === 0 && state.fundedRaw == null;
      state.unverified = d.amountsVerified === false && !state.settlementVerified && !state.notFunded;
      // An interrupted run may lack a complete summary while an earlier
      // stream.closed event already established its settlement amounts.
      if (!state.settlementVerified) {
        state.fundedRaw = state.unverified ? null : d.fundedRaw;
        state.earnedRaw = state.unverified ? null : state.notFunded ? "0" : d.earnedRaw;
        state.refundedRaw = state.unverified ? null : state.notFunded ? "0" : d.refundedRaw;
      }
      state.inputs = [];
      state.active = [];
    }
  }
  state.transactions = [...transactions.values()];
  state.auditReceipts = [...receipts.values()];
  return state;
}
export function timelinePresentation(event) {
  const d = event.data;
  if (event.type === "run.start")
    return {
      title: "Run started",
      chip: d.mode === "pay" ? "Pay" : "Preview",
      metric: "",
    };
  if (event.type === "run.end")
    return {
      title: `Run ${d.status}`,
      chip: "",
      metric:
        d.amountsVerified === false ? "Unverified" : formatUsdc(d.fundedRaw),
    };
  if (event.type === "cre.result") {
    const r = d.observations;
    return {
      title:
        d.target === "price"
          ? "Price safety"
          : d.target === "spend"
          ? "Spend review"
          : r.config.phase === "admission"
          ? "Stream admission"
          : r.config.phase === "shutdown"
          ? "Shutdown check"
          : d.decision === "CLOSE"
          ? d.reason === "SERVICE_UNAVAILABLE" ? "Outage checkpoint" : "Closure checkpoint"
          : "Health checkpoint",
      chip: d.decision,
      metric:
        d.target === "price"
          ? `${formatPrice(r.chainlinkPriceUsd8)} vs ${formatPrice(
              r.externalPriceUsd8
            )}`
          : d.target === "spend"
          ? `Risk ${r.decision.riskScore}`
          : r.config.streamId !== "0"
          ? `Stream #${r.config.streamId}`
          : formatUsdc(r.config.amountRaw),
    };
  }
  if (event.type === "wallet.tx")
    return {
      title: `Wallet ${d.kind}`,
      chip: d.status === "confirmed" ? "Confirmed" : "Pending",
      metric: shortAddress(d.hash),
    };
  if (event.type === "api.reuse")
    return {
      title: "Session reused",
      chip: "API",
      metric: `${d.successfulRequests} calls`,
    };
  if (event.type === "fault")
    return {
      title: "Injected outage",
      chip: "Outage",
      metric: String(d.httpStatus),
    };
  if (event.type === "stream.opened")
    return {
      title: "Escrow funded",
      chip: "Onchain",
      metric: formatUsdc(d.fundedRaw),
    };
  if (event.type === "stream.closed")
    return {
      title: "Stream closed",
      chip: "CLOSE",
      metric: formatUsdc(d.refundedRaw),
    };
  if (event.type === "audit.receipt")
    return {
      title: "Audit receipt",
      chip: "Onchain",
      metric: `${d.count} decisions`,
    };
  if (event.type === "cleanup")
    return {
      title: "Safety cleanup",
      chip: d.status === "closed" ? "Closed" : d.status === "attempting" ? "Checking" : "Attention",
      metric: `Stream #${d.streamId}`,
    };
  if (event.type === "error")
    return { title: d.code === "INTERRUPTED" ? "Run interrupted" : "Run error", chip: "ERROR", metric: d.code };
  return {
    title:
      d.stage === "cre"
        ? "CRE evaluation"
        : d.stage === "request"
        ? `${d.tier} request`
        : "Agent planning",
    chip: "",
    metric: "",
  };
}

// These are labels for observed execution facts, never new policy decisions.
export function workflowStatus(state) {
  const stop = state.interrupted ? "Run interrupted" : "Run failed";
  if (state.closed && state.settlementVerified) return {
    title: state.status === "failed" || state.errorCode ? `${stop} · stream closed` : "Stream closed and settled",
    detail: BigInt(state.refundedRaw) > 0n ? "Earned funds settled; unused escrow refunded." : "Deposit fully earned; no unused escrow remained.",
    tone: "allow",
  };
  const pending = [...state.transactions].reverse().find(t => t.status !== "confirmed");
  if (state.status === "failed" && state.notFunded) return {
    title: ["CRE_ACCOUNT_UNAVAILABLE","CRE_AUTH_REQUIRED"].includes(state.errorCode) ? "CRE account check failed · no stream funded" : "Run stopped before stream funding",
    detail: ["CRE_ACCOUNT_UNAVAILABLE","CRE_AUTH_REQUIRED"].includes(state.errorCode) ? "Check cre whoami in the local terminal. Reauthenticate with cre login only if needed, then retry when the account is reachable." : "No stream transaction was observed. Check the local CLI evidence before retrying.",
    tone: "warn",
  };
  if (state.cleanup === "needs-attention" || state.status === "failed") return {
    title: pending ? "Confirmation unresolved" : state.cleanup === "needs-attention" ? "Cleanup needs inspection" : stop,
    detail: pending ? "Inspect the signed transaction before retrying. Its final outcome is not confirmed here." : "Check the CLI evidence and stream state. An active stream may need separate operator recovery.",
    tone: "warn", hash: pending?.hash,
  };
  const close = [...state.transactions].reverse().find(t => t.kind === "close");
  if (close) return {
    title: close.status === "confirmed" ? "Close confirmed · checking settlement" : "Closing stream",
    detail: close.status === "confirmed" ? "Receipt confirmed; waiting for verified payout amounts." : "Close signed; waiting for confirmations. Escrow may accrue until the transaction is mined.",
    tone: "neutral", hash: close.hash,
  };
  if (state.cleanup === "attempting") return {
    title: state.shutdownApproved ? "Shutdown check passed" : "Requesting shutdown approval",
    detail: "The policy process must approve and sign the exact stream closure before audited cancellation.",
    tone: "neutral",
  };
  if (state.summary && state.status === "completed" && state.mode === "preview") return {
    title: "Preview complete · no payment signed",
    detail: "Live model and CRE checks finished. Escrow was not funded; paid service access stayed locked.",
    tone: "allow",
  };
  if (state.summary && state.status === "denied" && state.fundedRaw === "0") return {
    title: "Policy stopped funding",
    detail: "CRE rejected the proposal before any stream was funded. Inspect the decision in the timeline.",
    tone: "warn",
  };
  if (state.status === "running") {
    const event=state.latestEvent, d=event?.data || {};
    if (pending) return {
      title: pending.kind === "approval" ? "Approving USDC · awaiting confirmations" : "Funding stream · awaiting confirmations",
      detail: "The wallet signed this transaction. Wait for the confirmed receipt before starting another run.",
      tone: "neutral",hash:pending.hash,
    };
    if (event?.type === "cre.result" && d.target === "spend" && d.decision === "ALLOW") return {
      title: "Spend review passed · anchoring audit receipts",
      detail: "The exact transaction passed dry-run and risk checks. Audit receipt verification must finish before wallet signing.",
      tone: "neutral",
    };
    if (event?.type === "audit.receipt") return {
      title: "Audit receipt confirmed",
      detail: "The local runner is verifying proofs and preparing the next safe step.",tone:"neutral",
    };
    if (event?.type === "step.start" && d.stage === "cre") return {
      title: "Running local CRE checks",
      detail: "Reading external inputs and Sepolia state. The workflow result will appear in the timeline.",tone:"neutral",
    };
  }
  return null;
}
export function liveBalanceObservation(agent,run) {
  const after = run.summary?.balances?.after?.agentBalanceRaw;
  const start = run.start?.balances;
  return {
    usdcRaw: after ?? start?.payerUsdcRaw ?? agent?.balances?.usdcRaw,
    ethRaw: start?.payerEthRaw ?? agent?.balances?.ethRaw,
    usdcSource: after != null ? "at run end" : start ? "at run start" : "observed at preflight",
    ethSource: start ? "at run start; gas spend is not included" : "observed at preflight",
  };
}
export const recordingScenario = item => item.mode === "pay" ? "funded" : item.preset || "preview";
export function recordingChoices(items) {
  const sorted = [...items].sort((a,b) => Date.parse(b.capturedAt)-Date.parse(a.capturedAt) || b.id.localeCompare(a.id));
  const primary = ["funded","preview","tiny-cap","stale-feed"].map(key => sorted.find(item => recordingScenario(item) === key)).filter(Boolean);
  const ids = new Set(primary.map(item => item.id));
  return {primary, history: sorted.filter(item => !ids.has(item.id))};
}
export function recordingLabel(item) {
  const name = {funded:"Funded run",preview:"Preview (no txs)","tiny-cap":"Cap DENY","stale-feed":"Stale DENY"}[recordingScenario(item)] || item.label;
  return `${new Date(item.capturedAt).toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} · ${name}`;
}
