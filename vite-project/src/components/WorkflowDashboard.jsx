import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowUpRight,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Info,
} from "lucide-react";
import CopyButton from "./ui/CopyButton";
import WorkflowDiagram from "./WorkflowDiagram";
import { reduceRun, validateRun } from "../lib/run-events.mjs";
import { formatTokenUnits } from "../lib/token-units.mjs";
const empty = () => ({ events: [], status: "idle" });
const localDev =
  import.meta.env.DEV &&
  ["127.0.0.1", "localhost"].includes(window.location.hostname);
const token = (x) => (x == null ? "—" : `${formatTokenUnits(x, 6)} USDC`);
const stamp = (x) =>
  new Date(x).toLocaleString(undefined, { timeZoneName: "short" });
const explorer = (kind, value) =>
  `https://sepolia.etherscan.io/${kind}/${value}`;
const fields = [
  ["depositCapRaw", "Deposit cap (raw USDC)", 1, 100000],
  ["maxRateRawPerSecond", "Max rate (raw USDC / second)", 1, 100],
  ["maxPegDeviationBps", "Peg tolerance (bps)", 1, 100],
  ["maxDeviationBps", "Source disagreement (bps)", 1, 100],
  ["maxFeedAgeSeconds", "Max feed age (seconds)", 60, 86400],
  ["maxFailedRequests", "Failure threshold", 1, 3],
];
function facts(e) {
  const r = e.data.observations;
  if (e.data.target === "price") {
    const feed = BigInt(r.chainlinkPriceUsd8),
      market = BigInt(r.externalPriceUsd8);
    const abs = (n) => (n < 0n ? -n : n);
    const bps = (difference, base) =>
      base > 0n
        ? `${formatTokenUnits((difference * 1000000n) / base, 2)} bps`
        : "Unavailable";
    return [
      ["Coinbase", `$${formatTokenUnits(r.externalPriceUsd8, 8)}`],
      ["Chainlink", `$${formatTokenUnits(r.chainlinkPriceUsd8, 8)}`],
      [
        "Feed age / limit",
        `${r.observedAt - r.feedUpdatedAt}s / ${r.maxFeedAgeSeconds}s`,
      ],
      [
        "Source disagreement / limit",
        `${bps(abs(market - feed), feed)} / ${r.maxDeviationBps} bps`,
      ],
      [
        "Coinbase peg deviation / limit",
        `${bps(abs(market - 100000000n), 100000000n)} / ${
          r.maxPegDeviationBps
        } bps`,
      ],
      [
        "Chainlink peg deviation / limit",
        `${bps(abs(feed - 100000000n), 100000000n)} / ${
          r.maxPegDeviationBps
        } bps`,
      ],
      [
        "Intent / cap",
        `${token(r.request.amount)} / ${token(r.request.spendingCap)}`,
      ],
    ];
  }
  if (e.data.target === "stream")
    return [
      ["Read block", String(r.config.observationBlock)],
      [
        "Provider health",
        r.health.serviceAvailable ? "Available" : "Unavailable",
      ],
      [
        "Client successes / failures",
        `${r.config.client.successfulRequests} / ${r.config.client.failedRequests}`,
      ],
      [
        "Provider successes / failures",
        `${r.health.successfulRequests} / ${r.health.failedRequests}`,
      ],
      [
        "Deposit / cap",
        `${token(r.config.amountRaw)} / ${token(r.config.spendingCapRaw)}`,
      ],
      [
        "Rate / max",
        `${BigInt(r.config.amountRaw) / BigInt(r.config.durationSeconds)} / ${
          r.config.maxRateRawPerSecond
        } raw/s`,
      ],
      ["Failure threshold", String(r.config.maxFailedRequests)],
    ];
  return [
    ["Simulation", r.simulation?.status || "Incomplete"],
    ["Operation", r.decision.operation || "No operation authorized"],
    [
      "Risk / maximum",
      `${r.decision.riskScore} / ${r.intent?.policy.maxRiskScore ?? "—"}`,
    ],
    ["Observed USDC balance", token(r.chain?.balanceRaw)],
    ["Review amount cap", token(r.intent?.policy.maxAmountRaw)],
    ["Read block", String(r.observedBlock ?? "—")],
  ];
}
function EventCard({ event, artifact }) {
  const d = event.data;
  if (event.type === "cre.result")
    return (
      <article className="rounded-xl border border-blue-400/25 bg-blue-500/[.06] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">
            {d.target === "price"
              ? "USDC price safety"
              : d.target === "stream"
              ? "Stream supervision"
              : "Spend review"}
          </h4>
          <span className="text-xs text-blue-200">
            {d.hostCheck ? "CRE simulation" : "Review incomplete"}
          </span>
        </div>
        <p className="mt-2 font-mono text-lg text-blue-100">
          {d.decision}{" "}
          <span className="text-xs text-slate-400">{d.reason}</span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {d.target === "price"
            ? "Compare the payment asset’s independent prices, freshness and budget."
            : d.target === "stream"
            ? "Compare HTTP service observations and client counters with the bound Sepolia stream."
            : "Dry-run the exact wallet call and apply hard rules plus a transparent risk heuristic."}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {facts(event).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-xs text-slate-200">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-400">
          Host validation:{" "}
          {d.hostCheck
            ? "passed against the run configuration"
            : "incomplete; no spend authority"}
        </p>
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer rounded text-blue-200">
            Command, transcript and raw result
          </summary>
          <p className="mt-3 text-slate-400">
            Run from <code>cre/</code>. Local per-run configs and localhost
            service observations are simulation shortcuts.
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#0b101c] p-3">
            <code className="min-w-0 flex-1 break-all text-blue-100">
              {d.command}
            </code>
            <CopyButton
              value={`cd cre\n${d.command}`}
              label="Copy CRE command"
            />
          </div>
          {artifact(d.transcriptPath) && (
            <a
              className="mt-3 inline-flex min-h-9 items-center gap-1 text-blue-300"
              href={artifact(d.transcriptPath)}
              target="_blank"
              rel="noreferrer"
            >
              Original transcript <ArrowUpRight size={13} />
            </a>
          )}
          {artifact(d.configPath) && (
            <a
              className="ml-4 inline-flex min-h-9 items-center gap-1 text-blue-300"
              href={artifact(d.configPath)}
              target="_blank"
              rel="noreferrer"
            >
              Exact config <ArrowUpRight size={13} />
            </a>
          )}
          <pre
            className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#0b101c] p-3 text-[11px] leading-5"
            tabIndex={0}
          >
            {JSON.stringify(d.observations, null, 2)}
          </pre>
        </details>
      </article>
    );
  if (event.type === "wallet.tx")
    return (
      <article className="rounded-xl border border-emerald-400/25 bg-emerald-500/[.05] p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <h4 className="font-semibold">Wallet · {d.kind}</h4>
          <span className="text-xs text-emerald-200">
            {d.status === "confirmed"
              ? "Onchain · confirmed"
              : "Signed · confirmation pending"}
          </span>
        </div>
        <a
          href={d.explorerUrl}
          className="mt-2 inline-flex min-h-9 max-w-full items-center gap-2 break-all font-mono text-xs text-emerald-200"
          target="_blank"
          rel="noreferrer"
        >
          {d.hash}
          <ArrowUpRight size={14} className="shrink-0" />
        </a>
      </article>
    );
  if (event.type === "audit.receipt")
    return (
      <article className="rounded-xl border border-emerald-400/20 p-4 text-sm">
        <h4 className="font-semibold">
          Onchain audit inclusion · {d.count} decisions
        </h4>
        <p className="mt-2 text-xs text-slate-400">
          Operator-submitted hashes; not DON authorization. Separate receipt
          gas.
        </p>
        <a
          href={explorer("tx", d.hash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block break-all font-mono text-xs text-emerald-200"
        >
          {d.hash} ↗
        </a>
      </article>
    );
  const label =
    event.type === "api.reuse"
      ? `Stream #${d.streamId}: ${d.successfulRequests} successful requests / ${d.failedRequests} failures`
      : event.type === "fault"
      ? d.label
      : event.type === "stream.opened"
      ? `Stream #${d.streamId} funded: ${token(d.fundedRaw)}`
      : event.type === "stream.closed"
      ? `Stream #${d.streamId} closed: ${token(d.earnedRaw)} earned; ${token(
          d.refundedRaw
        )} refunded`
      : event.type === "cleanup"
      ? `Cleanup: ${d.status} · stream #${d.streamId}`
      : event.type === "error"
      ? `${d.code}: ${d.message}`
      : d.label;
  return (
    <article
      className={`rounded-xl border p-3 text-sm ${
        event.type === "error"
          ? "border-rose-400/30 text-rose-200"
          : "border-white/10 text-slate-300"
      }`}
    >
      <p>{label}</p>
      {event.type === "api.reuse" && (
        <p className="mt-1 text-xs text-slate-500">
          {d.hostCheckedNoPaymentTransactions
            ? `Host verified unchanged wallet nonce (${d.walletNonceBefore} → ${d.walletNonceAfter}) during this request batch.`
            : "Request counters reported by the CLI for this funded session."}
        </p>
      )}
    </article>
  );
}
export default function WorkflowDashboard() {
  const [mode, setMode] = useState("recorded"),
    [agent, setAgent] = useState(null),
    [manifest, setManifest] = useState([]),
    [selected, setSelected] = useState(""),
    [recording, setRecording] = useState(null),
    [policy, setPolicy] = useState(null),
    [pay, setPay] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [run, updateRun] = useState(empty),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(""),
    [connection, setConnection] = useState("Checking recorded evidence…"),
    [advanced, setAdvanced] = useState(false),
    [activeId, setActiveId] = useState(null);
  const source = useRef(null),
    timer = useRef(null);
  const stop = () => {
    clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  // Keep transport validation synchronous so malformed SSE data is caught by
  // the message handler instead of throwing later in a React state updater.
  const currentRun = useRef(empty());
  const setRun = useCallback((state) => {
    currentRun.current = state;
    updateRun(state);
  }, []);
  const apply = (e) => setRun(reduceRun(currentRun.current, e));
  useEffect(() => {
    const c = new AbortController();
    fetch(`${import.meta.env.BASE_URL}runs/index.json`, {
      signal: c.signal,
      cache: "no-cache",
    })
      .then((r) => {
        if (!r.ok) throw new Error("Recorded run index unavailable.");
        return r.json();
      })
      .then((data) => {
        if (data.schemaVersion !== 1 || !Array.isArray(data.runs))
          throw new Error("Invalid recorded run index.");
        const list = [...data.runs].sort(
          (a, b) => Number(b.mode === "pay") - Number(a.mode === "pay")
        );
        setManifest(list);
        setSelected(list[0]?.id || "");
        setConnection(
          list.length
            ? "Recorded evidence ready."
            : "No captured runs have been published yet."
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => {
      c.abort();
      source.current?.close();
      clearInterval(timer.current);
    };
  }, []);
  const connect = useCallback(async () => {
    if (!localDev) return;
    try {
      const response = await fetch("/api/agent", {
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Start npm run dev:live."
        );
      const data = await response.json();
      setAgent(data);
      setConnection(
        "Local server connected. CRE and signing run on this computer."
      );
      setPay(false);
      setConfirmed(false);
    } catch (e) {
      setConnection(
        "Local runner unavailable. Recorded mode is available; start npm run dev:live."
      );
      setError(e.message || "Local server not connected.");
    }
  }, []);
  useEffect(() => {
    if (localDev) connect();
  }, [connect]); // Only local Vite development probes its same-origin API.
  useEffect(() => {
    if (mode !== "recorded" || !selected) return;
    const c = new AbortController();
    let live = true;
    setRecording(null);
    setError("");
    setRun(empty());
    const item = manifest.find((x) => x.id === selected);
    if (!item) return;
    fetch(`${import.meta.env.BASE_URL}runs/${item.file}`, {
      signal: c.signal,
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Recorded events unavailable.");
        const text = await response.text();
        const bytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(text)
        );
        const digest = Array.from(new Uint8Array(bytes))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        if (digest !== item.sha256)
          throw new Error("Recorded event hash mismatch.");
        const events = validateRun(
          text
            .trim()
            .split("\n")
            .map((x) => JSON.parse(x))
        );
        if (events[0].runId !== item.id)
          throw new Error("Recorded run ID mismatch.");
        if (live) {
          setRecording({ item, events });
          setPolicy(events[0].data.profile.policy);
        }
      })
      .catch((e) => {
        if (live && e.name !== "AbortError") setError(e.message);
      });
    return () => {
      live = false;
      c.abort();
      clearInterval(timer.current);
      setPlaying(false);
    };
  }, [mode, selected, manifest, setRun]);
  const profile =
    mode === "live" ? agent?.profile : recording?.events[0].data.profile;
  const info =
    run.start || (mode === "recorded" ? recording?.events[0].data : null);
  const balances =
    mode === "live"
      ? agent?.balances
      : {
          usdcRaw: info?.balances.payerUsdcRaw,
          ethRaw: info?.balances.payerEthRaw,
        };
  const working =
    busy || playing || (run.status === "running" && mode === "live");
  function changeMode(next) {
    source.current?.close();
    stop();
    setMode(next);
    setRun(empty());
    setError("");
    setPay(false);
    setConfirmed(false);
    if (next === "live") setPolicy(agent.profile.policy);
  }
  function listen(id) {
    source.current?.close();
    setRun(empty());
    setActiveId(id);
    setBusy(true);
    const stream = new EventSource(`/api/runs/${id}/events`);
    source.current = stream;
    stream.onmessage = (event) => {
      try {
        const e = JSON.parse(event.data);
        apply(e);
        if (e.type === "run.end") {
          stream.close();
          setBusy(false);
        }
      } catch {
        stream.close();
        setError(
          "Invalid event stream. Inspect the local CLI before retrying."
        );
        setBusy(false);
      }
    };
    stream.onerror = () => {
      stream.close();
      setBusy(false);
      setError(
        "Event connection closed. The local run may still be active; reconnect to its timeline before starting another payment."
      );
    };
  }
  async function start(e) {
    e.preventDefault();
    setError("");
    if (mode === "recorded") {
      if (!recording) return;
      if (playing) {
        stop();
        return;
      }
      let index = run.summary ? 0 : run.events.length;
      if (index === 0) setRun(empty());
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        let state = empty();
        for (const event of recording.events) state = reduceRun(state, event);
        setRun(state);
        return;
      }
      setPlaying(true);
      timer.current = setInterval(() => {
        if (index >= recording.events.length) {
          stop();
          return;
        }
        try {
          apply(recording.events[index++]);
        } catch {
          stop();
          setError(
            "Recorded event sequence is invalid. Reload the captured evidence."
          );
        }
      }, 350);
      return;
    }
    if (!policy || !agent) return;
    setBusy(true);
    setRun(empty());
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agentpay-token": agent.token,
        },
        body: JSON.stringify({
          profileId: profile.id,
          mode: pay ? "pay" : "preview",
          confirmPay: confirmed,
          policy,
        }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConfirmed(false);
      listen(data.id);
    } catch (e) {
      setError(
        e.message || "Local run could not start. Check the server terminal."
      );
      setBusy(false);
    }
  }
  const artifact = (file) => {
    if (!file) return null;
    if (mode === "live")
      return activeId
        ? `/api/runs/${activeId}/artifact?path=${encodeURIComponent(file)}`
        : null;
    const mapped = recording?.item.artifacts[file];
    return mapped
      ? `${import.meta.env.BASE_URL}runs/${recording.item.id}/${mapped}`
      : null;
  };
  const visible = run.events.filter(
    (e, index, all) =>
      !["run.start", "run.end"].includes(e.type) &&
      (e.type !== "wallet.tx" ||
        !all
          .slice(index + 1)
          .some(
            (x) => x.type === "wallet.tx" && x.data.hash === e.data.hash
          )) &&
      (advanced ||
        (e.type !== "audit.receipt" &&
          !(e.type === "cre.result" && e.data.target === "spend") &&
          !(
            e.type === "step.start" &&
            e.data.command?.includes("spend-settings")
          )))
  );
  const latest = run.events.filter((e) => e.type === "cre.result").at(-1)
    ?.data.decision;
  const summary = run.summary,
    unknown = summary?.amountsVerified === false;
  return (
    <div className="space-y-6">
      <WorkflowDiagram decision={latest} />
      <section className="space-y-4" aria-labelledby="dashboard-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Agent execution dashboard</p>
            <h2 id="dashboard-title" className="mt-2 text-xl font-semibold">
              Watch CRE decisions become wallet actions.
            </h2>
          </div>
          <div
            role="group"
            aria-label="Dashboard mode"
            className="flex rounded-xl border border-white/10 p-1"
          >
            <button
              className={`min-h-11 rounded-lg px-4 text-sm ${
                mode === "recorded"
                  ? "bg-blue-500/20 text-blue-100"
                  : "text-slate-400"
              }`}
              onClick={() => changeMode("recorded")}
              disabled={busy}
            >
              Recorded
            </button>
            <button
              className={`min-h-11 rounded-lg px-4 text-sm ${
                mode === "live"
                  ? "bg-blue-500/20 text-blue-100"
                  : "text-slate-400"
              }`}
              onClick={() => agent && changeMode("live")}
              disabled={!agent || busy}
            >
              Live local
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4 text-xs text-slate-400">
          <p>
            {mode === "recorded"
              ? recording
                ? `Recorded ${stamp(recording.item.capturedAt)} · ${
                    recording.item.label
                  } · Replay only; no new transactions.`
                : connection
              : connection}
          </p>
          {localDev && (
            <button
              onClick={connect}
              disabled={working}
              className="inline-flex min-h-9 items-center gap-2 text-blue-300"
            >
              <RefreshCw size={14} />
              Check local runner
            </button>
          )}
          {!localDev && (
            <span>
              Hosted mode never contacts your localhost. Start{" "}
              <code>npm run dev:live</code> locally to run CRE.
            </span>
          )}
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4">
            <section className="panel p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">
                  {profile?.name || "Agent profile"}
                </h3>
                <span className="text-[11px] text-blue-200">
                  {profile ? "Registered locally" : "Loading evidence"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Local profile file; no onchain registry.
              </p>
              {profile && (
                <>
                  <p className="mt-4 text-xs text-slate-400">
                    Planner: {mode === "live" ? agent.planner : info?.planner}
                  </p>
                  <dl className="mt-4 space-y-3 text-xs">
                    {[
                      ["Payer", profile.payer, "address"],
                      ["Recipient", profile.recipient, "address"],
                      ["Circle test USDC", profile.token, "token"],
                      ["Escrow", profile.escrow, "address"],
                    ].map(([label, value, kind]) => (
                      <div key={label}>
                        <dt className="text-slate-500">{label}</dt>
                        <dd>
                          <a
                            href={explorer(kind, value)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all font-mono text-blue-200"
                          >
                            {value} ↗
                          </a>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">
                        {mode === "recorded"
                          ? "USDC at run start"
                          : "Observed USDC"}
                      </p>
                      <p className="mt-1">{token(balances?.usdcRaw)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        {mode === "recorded"
                          ? "ETH at run start"
                          : "Observed ETH"}
                      </p>
                      <p className="mt-1">
                        {balances?.ethRaw
                          ? formatTokenUnits(balances.ethRaw, 18)
                          : "—"}{" "}
                        ETH
                      </p>
                    </div>
                  </div>
                </>
              )}
            </section>
            <form className="panel space-y-4 p-5" onSubmit={start}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Run policy</h3>
                <button
                  type="button"
                  className="min-h-9 text-xs text-blue-300"
                  disabled={working || !profile || mode !== "live"}
                  onClick={() => {
                    setPolicy(agent.profile.policy);
                    setConfirmed(false);
                  }}
                >
                  Reset
                </button>
              </div>
              {mode === "recorded" && (
                <label className="block text-xs text-slate-400">
                  Captured run
                  <select
                    className="input-default mt-2 w-full"
                    aria-label="Captured run"
                    disabled={playing}
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {!manifest.length && (
                      <option value="">No captures available</option>
                    )}
                    {manifest.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} ·{" "}
                        {new Date(r.capturedAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-xs leading-relaxed text-slate-500">
                Fixed service quote: 0.01 USDC over 1000 seconds. Premium
                attempt and injected outage follow the CLI demo. The planner
                cannot change amounts or recipients.
              </p>
              {fields.map(([key, label, min, max]) => (
                <label key={key} className="block text-xs text-slate-400">
                  {label}
                  <input
                    className="input-default mt-1 w-full"
                    type="number"
                    min={min}
                    max={max}
                    step="1"
                    required
                    value={policy?.[key] ?? ""}
                    disabled={mode !== "live" || working || !profile}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        [key]:
                          key.endsWith("Raw") || key.endsWith("PerSecond")
                            ? e.target.value
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
              {mode === "live" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      disabled={working}
                      onClick={() =>
                        setPolicy({
                          ...agent.profile.policy,
                          depositCapRaw: "9999",
                        })
                      }
                    >
                      Tiny cap
                    </button>
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      disabled={working}
                      onClick={() =>
                        setPolicy({
                          ...agent.profile.policy,
                          maxFeedAgeSeconds: 60,
                        })
                      }
                    >
                      Stale feed
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tiny cap is below the fixed request. A 60s feed limit may
                    deny, depending on live feed age. No finer-than-1-bp peg
                    preset.
                  </p>
                  <label className="flex items-start gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={pay}
                      disabled={working || !agent.payEnabled || !agent.payReady}
                      onChange={(e) => {
                        setPay(e.target.checked);
                        setConfirmed(false);
                      }}
                    />
                    Pay on Sepolia (Preview by default)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {!agent.payEnabled
                      ? "Pay disabled: server must opt in with PAY_ENABLED=1."
                      : !agent.payReady
                      ? "Pay disabled: fund at least 0.01 test USDC and 0.001 Sepolia ETH."
                      : "Pay uses test ETH for stream and audit transactions."}
                  </p>
                  {pay && (
                    <label className="flex items-start gap-2 text-xs leading-relaxed text-amber-200">
                      <input
                        type="checkbox"
                        required
                        checked={confirmed}
                        disabled={working}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      I authorize up to 0.01 test USDC in escrow plus Sepolia
                      test ETH gas for this run.
                    </label>
                  )}
                </>
              )}
              <button
                className="btn-primary w-full"
                type="submit"
                disabled={
                  mode === "live"
                    ? working || !agent || (pay && !confirmed)
                    : !recording
                }
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                {mode === "recorded"
                  ? playing
                    ? "Pause replay"
                    : run.events.length && !run.summary
                    ? "Resume replay"
                    : "Replay recorded run"
                  : busy
                  ? "Run in progress…"
                  : pay
                  ? "Run · Pay"
                  : "Run · Preview"}
              </button>
              {mode === "recorded" && (
                <button
                  className="btn-outline w-full"
                  type="button"
                  disabled={!recording}
                  onClick={() => {
                    stop();
                    setRun(empty());
                  }}
                >
                  <RotateCcw size={15} />
                  Restart replay
                </button>
              )}
              {mode === "live" && (activeId || agent.activeRunId) && (
                <button
                  className="btn-outline w-full"
                  type="button"
                  onClick={() => listen(activeId || agent.activeRunId)}
                >
                  Reconnect active timeline
                </button>
              )}
            </form>
          </aside>
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                [
                  "Funded",
                  unknown
                    ? "Unverified"
                    : token(summary?.fundedRaw ?? run.stream?.fundedRaw),
                ],
                [
                  "Earned",
                  unknown
                    ? "Unverified"
                    : token(summary?.earnedRaw ?? run.stream?.earnedRaw),
                ],
                [
                  "Refunded",
                  unknown
                    ? "Unverified"
                    : token(summary?.refundedRaw ?? run.stream?.refundedRaw),
                ],
                [
                  "API successes",
                  String(run.requests?.successfulRequests ?? 0),
                ],
              ].map(([label, value]) => (
                <div className="panel min-w-0 p-4" key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 break-words text-lg font-semibold">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <section className="panel p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Terminal size={17} />
                  Decision timeline
                </h3>
                <span className="text-xs text-slate-400">
                  {mode === "recorded" ? "Recorded replay" : "Live local run"} ·{" "}
                  {playing ? "playing" : run.status}
                </span>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={advanced}
                  onChange={(e) => setAdvanced(e.target.checked)}
                />
                Advanced: spend reviews and onchain audit receipts
              </label>
              <p
                role="status"
                aria-live="polite"
                className="mt-3 text-xs text-slate-500"
              >
                {run.events.length} events received
                {latest ? ` · Last CRE decision ${latest}` : ""}.
              </p>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 text-sm text-rose-200"
                >
                  {error}
                </p>
              )}
              <div className="mt-4 space-y-3">
                {!visible.length && (
                  <p className="rounded-xl border border-dashed border-white/10 p-8 text-sm leading-relaxed text-slate-400">
                    {mode === "recorded"
                      ? "Choose a captured run and replay the actual CLI events. No decisions are generated in this browser."
                      : "Choose policy limits and run Preview. The local CLI will supply decisions as they complete."}
                  </p>
                )}
                {visible.map((e) => (
                  <div key={`${e.runId}-${e.seq}`}>
                    <p className="mb-1 font-mono text-[10px] text-slate-600">
                      {String(e.seq).padStart(2, "0")} · {stamp(e.at)}
                    </p>
                    <EventCard event={e} artifact={artifact} />
                  </div>
                ))}
              </div>
            </section>
            {summary && (
              <section className="panel p-5">
                <h3 className="font-semibold">Run {summary.status}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {unknown
                    ? "Amounts could not be verified. Inspect transaction receipts and local evidence before retrying."
                    : `${
                        summary.transactions.length
                      } payment lifecycle transactions; ${
                        run.receipts?.length || 0
                      } audit receipt transactions observed. No payment transaction per API request.`}
                </p>
                {summary.balances.before?.agentBalanceRaw && (
                  <p className="mt-2 text-sm text-slate-300">
                    Payer: {token(summary.balances.before.agentBalanceRaw)} →{" "}
                    {token(summary.balances.after.agentBalanceRaw)}. Recipient:{" "}
                    {token(summary.balances.before.recipientBalanceRaw)} →{" "}
                    {token(summary.balances.after.recipientBalanceRaw)}.
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Balance snapshots bracket the payment journey; the final audit
                  flush may use additional test ETH.
                </p>
              </section>
            )}
          </div>
        </div>
        <div className="flex gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[.04] p-5">
          <Info size={20} className="shrink-0 text-amber-200" />
          <p className="text-xs leading-relaxed text-slate-400">
            <strong className="text-amber-100">
              Trust boundary, always visible.
            </strong>{" "}
            CRE decisions come from local simulation, with no DON authorization.
            The wallet CLI gates signing; the contract does not verify CRE
            results. It enforces escrow, time accrual and payouts. Audit
            receipts prove inclusion of operator-submitted hashes, not
            correctness. Localhost health snapshots and per-run configs are
            simulation shortcuts. Not full x402; unaudited prototype; test USDC
            has no monetary value.
          </p>
        </div>
      </section>
    </div>
  );
}
