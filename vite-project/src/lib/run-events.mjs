export const EVENT_TYPES = Object.freeze([
  "run.start",
  "step.start",
  "cre.result",
  "api.reuse",
  "fault",
  "wallet.tx",
  "audit.receipt",
  "stream.opened",
  "stream.closed",
  "cleanup",
  "run.end",
  "error",
]);
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const uint = (x) => typeof x === "string" && /^[0-9]+$/.test(x);
const hash = (x) => typeof x === "string" && /^0x[0-9a-f]{64}$/i.test(x);
export function validateEvent(e) {
  if (
    !object(e) ||
    Object.keys(e).sort().join() !== "at,data,runId,schemaVersion,seq,type" ||
    e.schemaVersion !== 1 ||
    !EVENT_TYPES.includes(e.type) ||
    !/^[a-zA-Z0-9-]{8,100}$/.test(e.runId) ||
    !Number.isSafeInteger(e.seq) ||
    e.seq < 1 ||
    typeof e.at !== "string" ||
    !Number.isFinite(Date.parse(e.at)) ||
    !object(e.data)
  )
    throw new Error("Invalid run event envelope.");
  const d = e.data;
  if (JSON.stringify(e).length > 200000)
    throw new Error("Run event too large.");
  function inspect(x) {
    if (
      typeof x === "string" &&
      /(?:^|\s)(?:\/Users\/|\/home\/|\/private\/|[A-Za-z]:\\)/.test(x)
    )
      throw new Error("Absolute path in public event.");
    if (!x || typeof x !== "object") return;
    for (const [key, v] of Object.entries(x)) {
      if (
        /^(?:apiKey|privateKey|secret|authorization|prompt|input|output|env)$/i.test(
          key
        )
      )
        throw new Error("Private field in public event.");
      inspect(v);
    }
  }
  inspect(d);
  if (
    e.type === "run.start" &&
    (!["preview", "pay"].includes(d.mode) ||
      !object(d.profile) ||
      typeof d.planner !== "string" ||
      !object(d.balances))
  )
    throw new Error("Invalid run start.");
  if(e.type === "run.start" && e.data.contractPolicySignatures !== undefined && typeof e.data.contractPolicySignatures !== "boolean") throw new Error("Invalid contract enforcement marker.");
  if (
    e.type === "cre.result" &&
    (!["price", "stream", "spend"].includes(d.target) ||
      typeof d.command !== "string" ||
      ![
        "ALLOW",
        "DENY",
        "OPEN",
        "CONTINUE",
        "CLOSE",
        "BLOCK",
        "ERROR",
      ].includes(d.decision) ||
      typeof d.reason !== "string" ||
      typeof d.hostCheck !== "boolean" ||
      !object(d.observations))
  )
    throw new Error("Invalid CRE result.");
  if (e.type === "cre.result") {
    const r = d.observations;
    const nonnegative = (n) => Number.isSafeInteger(n) && n >= 0;
    const counters = (v) =>
      object(v) &&
      nonnegative(v.successfulRequests) &&
      nonnegative(v.failedRequests);
    if (
      d.target === "price" &&
      (!uint(r.externalPriceUsd8) ||
        !uint(r.chainlinkPriceUsd8) ||
        !nonnegative(r.observedAt) ||
        !nonnegative(r.feedUpdatedAt) ||
        !nonnegative(r.maxFeedAgeSeconds) ||
        !nonnegative(r.maxDeviationBps) ||
        !nonnegative(r.maxPegDeviationBps) ||
        !object(r.request) ||
        !uint(r.request.amount) ||
        !uint(r.request.spendingCap))
    )
      throw new Error("Invalid price observations.");
    if (
      d.target === "stream" &&
      (!object(r.config) ||
        !uint(r.config.amountRaw) ||
        !uint(r.config.spendingCapRaw) ||
        !nonnegative(r.config.durationSeconds) ||
        r.config.durationSeconds === 0 ||
        !uint(r.config.maxRateRawPerSecond) ||
        !nonnegative(r.config.observationBlock) ||
        !nonnegative(r.config.maxFailedRequests) ||
        !counters(r.config.client) ||
        !counters(r.health) ||
        typeof r.health.serviceAvailable !== "boolean")
    )
      throw new Error("Invalid stream observations.");
    if (
      d.target === "spend" &&
      (!object(r.decision) ||
        (typeof r.decision.operation !== "string" &&
          r.decision.operation !== undefined) ||
        !nonnegative(r.decision.riskScore) ||
        r.decision.riskScore > 100 ||
        (r.intent !== undefined &&
          (!object(r.intent) || !object(r.intent.policy))))
    )
      throw new Error("Invalid spend observations.");
  }
  for (const key of ["configPath", "transcriptPath"])
    if (
      d[key] !== undefined &&
      (typeof d[key] !== "string" ||
        !/^(?:\.local|docs)\/[a-zA-Z0-9_./-]+$/.test(d[key]) ||
        d[key].split("/").includes(".."))
    )
      throw new Error("Unsafe artifact path.");
  if (
    e.type === "wallet.tx" &&
    (!["approval", "open", "close"].includes(d.kind) ||
      !hash(d.hash) ||
      !["submitting", "confirmed"].includes(d.status) ||
      d.explorerUrl !== `https://sepolia.etherscan.io/tx/${d.hash}`)
  )
    throw new Error("Invalid wallet transaction.");
  if (
    e.type === "audit.receipt" &&
    (!hash(d.hash) ||
      !hash(d.root) ||
      !Number.isSafeInteger(d.count) ||
      d.count < 1)
  )
    throw new Error("Invalid audit receipt.");
  if (
    e.type === "api.reuse" &&
    (![d.successfulRequests, d.failedRequests].every(
      (n) => Number.isSafeInteger(n) && n >= 0
    ) ||
      !/^[1-9][0-9]*$/.test(d.streamId))
  )
    throw new Error("Invalid request counters.");
  if (
    e.type === "api.reuse" &&
    d.hostCheckedNoPaymentTransactions !== undefined &&
    (d.hostCheckedNoPaymentTransactions !== true ||
      !Number.isSafeInteger(d.walletNonceBefore) ||
      d.walletNonceBefore < 0 ||
      d.walletNonceAfter !== d.walletNonceBefore)
  )
    throw new Error("Invalid request batch nonce evidence.");
  if (
    e.type === "run.end" &&
    (!["completed", "denied", "failed"].includes(d.status) ||
      ![d.fundedRaw, d.earnedRaw, d.refundedRaw].every(
        (x) =>
          uint(x) ||
          (d.status === "failed" && d.amountsVerified === false && x === null)
      ) ||
      !Array.isArray(d.transactions) ||
      !object(d.balances))
  )
    throw new Error("Invalid run summary.");
  if (
    e.type === "error" &&
    (typeof d.code !== "string" || typeof d.message !== "string")
  )
    throw new Error("Invalid error.");
  return e;
}
export function validateRun(events) {
  if (
    !events.length ||
    events[0].type !== "run.start" ||
    events.at(-1).type !== "run.end"
  )
    throw new Error("Incomplete run.");
  events.forEach((e, i) => {
    validateEvent(e);
    if (
      e.seq !== i + 1 ||
      e.runId !== events[0].runId ||
      (i < events.length - 1 && e.type === "run.end")
    )
      throw new Error("Run sequence mismatch.");
  });
  return events;
}
export function reduceRun(state = { events: [], status: "idle" }, event) {
  validateEvent(event);
  if (state.events.some((e) => e.runId === event.runId && e.seq === event.seq))
    return state;
  if (
    (state.events.length && event.runId !== state.events[0].runId) ||
    event.seq !== state.events.length + 1
  )
    throw new Error("Missing or mismatched run event.");
  if (state.summary) throw new Error("Event after run end.");
  const events = [...state.events, event];
  return {
    events,
    status: event.type === "run.end" ? event.data.status : "running",
    start: events.find((e) => e.type === "run.start")?.data,
    summary: event.type === "run.end" ? event.data : state.summary,
    requests: event.type === "api.reuse" ? event.data : state.requests,
    stream: ["stream.opened", "stream.closed"].includes(event.type)
      ? { ...state.stream, ...event.data }
      : state.stream,
    transactions: events
      .filter((e) => e.type === "wallet.tx")
      .reduce((a, e) => ({ ...a, [e.data.hash]: e.data }), {}),
    receipts: events
      .filter((e) => e.type === "audit.receipt")
      .map((e) => e.data),
  };
}
