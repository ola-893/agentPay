import { useEffect, useRef } from "react";
import {
  ChevronDown,
  Workflow,
  Wallet,
  Radio,
  AlertTriangle,
  Bot,
  Database,
} from "lucide-react";
import CopyButton from "./ui/CopyButton";
import { DecisionBadge, Address } from "./WorkflowBits";
import {
  eventNodes,
  timelinePresentation,
  formatUsdc,
} from "../lib/workflow-view.mjs";
import { formatTokenUnits } from "../lib/token-units.mjs";
const token = formatUsdc;
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

export default function WorkflowTimeline({
  currentEvent,
  events,
  artifact,
  advanced,
  setAdvanced,
  onHighlight,
  jump,
}) {
  const feed = useRef(null);
  const last = events.at(-1);
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last?.seq]);
  useEffect(() => {
    if (!jump) return;
    const row = document.getElementById(`wf-event-${jump.seq}`);
    row?.scrollIntoView({ block: "nearest", behavior: "instant" });
    row?.querySelector("summary")?.focus({ preventScroll: true });
  }, [jump]);
  const announced = currentEvent || last;
  const current = announced ? timelinePresentation(announced) : null;
  return (
    <section className="wf-surface wf-timeline" aria-label="Execution timeline">
      <div className="wf-timeline-heading">
        <h2>Timeline</h2>
        <label>
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />{" "}
          Show advanced
        </label>
      </div>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announced
          ? `Step ${announced.seq}. ${current.title}. ${current.chip}. ${current.metric}.`
          : "Awaiting run events."}
      </p>
      <div className="wf-timeline-feed" ref={feed}>
        {!events.length && <p className="wf-empty">Decisions appear here.</p>}
        {events.map((event) => {
          const d = event.data,
            presentation = timelinePresentation(event);
          const Icon =
            event.type === "cre.result"
              ? Workflow
              : event.type === "wallet.tx"
              ? Wallet
              : event.type === "fault" || event.type === "error"
              ? AlertTriangle
              : event.type === "api.reuse"
              ? Radio
              : event.type.startsWith("stream.")
              ? Database
              : Bot;
          return (
            <details
              className="wf-event"
              id={`wf-event-${event.seq}`}
              key={`${event.runId}-${event.seq}`}
              onMouseEnter={() => onHighlight(eventNodes(event))}
              onMouseLeave={() => onHighlight([])}
              onFocus={() => onHighlight(eventNodes(event))}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) onHighlight([]);
              }}
            >
              <summary>
                <span className="wf-step-number">
                  {String(event.seq).padStart(2, "0")}
                </span>
                <Icon size={15} aria-hidden="true" />
                <span className="wf-event-title">{presentation.title}</span>
                <DecisionBadge value={presentation.chip} />
                <span className="wf-event-metric">{presentation.metric}</span>
                <ChevronDown
                  size={13}
                  className="wf-chevron"
                  aria-hidden="true"
                />
              </summary>
              <div className="wf-event-detail">
                <p className="wf-detail-meta">
                  {new Date(event.at).toLocaleString()} · {event.type}
                </p>
                {event.type === "cre.result" && (
                  <>
                    <p>
                      <strong>{d.reason}</strong> ·{" "}
                      {d.hostCheck
                        ? "Host validation passed"
                        : "Review incomplete; no spend authority"}
                    </p>
                    <dl>
                      {facts(event).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="wf-command">
                      <code>
                        cd cre{`\n`}
                        {d.command}
                      </code>
                      <CopyButton
                        value={`cd cre\n${d.command}`}
                        label="Copy CRE command"
                        className="wf-icon"
                      />
                    </div>
                    <div className="wf-artifact-links">
                      {[
                        [d.transcriptPath, "Original transcript"],
                        [d.configPath, "Exact config"],
                      ].map(
                        ([file, label]) =>
                          artifact(file) && (
                            <a
                              key={label}
                              href={artifact(file)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {label} ↗
                            </a>
                          )
                      )}
                    </div>
                    <details className="wf-raw">
                      <summary>Raw result</summary>
                      <pre tabIndex={0}>
                        {JSON.stringify(d.observations, null, 2)}
                      </pre>
                    </details>
                  </>
                )}
                {event.type === "wallet.tx" && (
                  <Address
                    value={d.hash}
                    label={`${d.kind} transaction`}
                    kind="tx"
                    full
                  />
                )}
                {event.type === "audit.receipt" && (
                  <>
                    <Address
                      value={d.hash}
                      label="audit receipt"
                      kind="tx"
                      full
                    />
                    <p>
                      Operator-submitted hashes; separate receipt gas. May
                      include earlier pending decisions.
                    </p>
                  </>
                )}
                {event.type !== "cre.result" &&
                  event.type !== "wallet.tx" &&
                  event.type !== "audit.receipt" && (
                    <pre tabIndex={0}>{JSON.stringify(d, null, 2)}</pre>
                  )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
