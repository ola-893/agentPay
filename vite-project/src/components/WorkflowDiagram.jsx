import {
  Bot,
  Workflow,
  Wallet,
  Database,
  Globe,
  LockKeyhole,
  DollarSign,
  Radio,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import { DecisionBadge } from "./WorkflowBits";
import { formatUsdc, percentOf, shortAddress } from "../lib/workflow-view.mjs";
const nodes = [
  ["agent", "Agent", Bot, "Proposes paid work"],
  ["wallet", "Wallet", Wallet, "Signs approved calls"],
  ["escrow", "Escrow", Database, "Accrues over time"],
  ["service", "Paid service", Globe, "Serves authenticated requests"],
];
const inputs = [
  ["coinbase", "Coinbase", DollarSign],
  ["feed", "Chainlink USDC/USD", Radio],
  ["health", "Service health", Activity],
  ["state", "Stream state", Database],
];
function Gauge({ state }) {
  const funded = state.fundedRaw != null && BigInt(state.fundedRaw) > 0n;
  return (
    <div
      className="wf-gauge-wrap"
      title={
        state.unverified
          ? "Amounts unverified"
          : `${state.fundedRaw ?? "Unknown"} raw USDC funded`
      }
    >
      <div
        className="wf-gauge"
        role="img"
        aria-label={
          state.unverified
            ? "Escrow amounts unverified"
            : state.closed
            ? `${formatUsdc(state.earnedRaw)} earned; ${formatUsdc(
                state.refundedRaw
              )} refunded`
            : funded
            ? `${formatUsdc(state.fundedRaw)} in escrow`
            : "Escrow not funded"
        }
      >
        <span
          style={{
            width: state.closed
              ? percentOf(state.earnedRaw, state.fundedRaw)
              : funded
              ? "100%"
              : "0%",
          }}
        />
        {state.closed && (
          <span
            className="wf-refund-bar"
            style={{ width: percentOf(state.refundedRaw, state.fundedRaw) }}
          />
        )}
      </div>
      <small>
        {state.unverified
          ? "Unverified"
          : state.closed
          ? "Settled"
          : funded
          ? formatUsdc(state.fundedRaw)
          : "Unfunded"}
      </small>
    </div>
  );
}
export default function WorkflowDiagram({
  state,
  highlight,
  onNode,
  onReplay,
  replayDisabled,
  mode,
}) {
  const idle = state.status === "idle";
  const active = (id) =>
    highlight.length ? highlight.includes(id) : state.active.includes(id);
  const calls =
    state.successfulRequests == null
      ? idle
        ? "0 calls"
        : "Calls —"
      : `${state.successfulRequests} calls${
          state.reuseTransactions === 0 ? " · 0 txs" : ""
        }`;
  const nodeBody = (id, label, Icon, caption) => (
    <>
      <span className="wf-node-tile">
        <Icon size={30} aria-hidden="true" />
      </span>
      <span className="wf-node-copy">
        <strong>{label}</strong>
        <span className="wf-node-caption">{caption}</span>
      </span>
      {id === "escrow" && <Gauge state={state} />}
      {id === "service" && state.service === "outage" && (
        <>
          <DecisionBadge value="Outage" />
          {state.faultStatus != null && <small>{state.faultStatus}</small>}
        </>
      )}
    </>
  );
  const hub = (
    <button
      type="button"
      className={`wf-hub ${active("cre") ? "is-active" : ""}`}
      onClick={() => onNode("cre")}
      aria-label="Find deterministic CRE policy results"
    >
      <span>
        <Workflow size={18} aria-hidden="true" /> Chainlink CRE
      </span>
      {state.decision ? (
        <DecisionBadge value={state.decision} />
      ) : (
        <small>Deterministic policy</small>
      )}
    </button>
  );
  return (
    <section
      className="wf-surface wf-diagram"
      aria-label="Deterministic CRE payment guardrails"
    >
      <p className="sr-only">
        Price feeds, service health and stream state feed CRE. The wallet CLI
        gates signing, escrow accrues earnings, and API calls reuse a funded
        stream. CRE does not authorize the contract directly. Use diagram nodes
        to find their timeline events.
      </p>
      <div className={`wf-canvas ${idle ? "wf-ghost" : ""}`}>
        <div className="wf-inputs">
          {inputs.map(([id, label, Icon]) => (
            <span
              key={`${id}-${state.lastSeq}`}
              className={state.inputs.includes(id) ? "wf-input-pulse" : ""}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
        <div className="wf-desktop-diagram">
          <svg
            viewBox="0 0 800 480"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="wf-connections"
          >
            <defs>
              <marker
                id="wf-arrow"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L7,3.5 L0,7" fill="#64748b" />
              </marker>
            </defs>
            {[100, 300, 500, 700].map((x) => (
              <path
                key={x}
                d={`M${x},52 Q${x},80 400,103`}
                className="wf-input-edge"
              />
            ))}
            <path
              d="M365,161 Q290,173 300,221"
              className="wf-supervision-edge"
            />
            <path
              d="M420,161 Q485,177 500,221"
              className="wf-supervision-edge"
            />
            <path
              d="M454,142 Q700,145 700,221"
              className="wf-supervision-edge"
            />
            <text x="236" y="194">
              gates signing
            </text>
            <text x="467" y="194">
              reads state
            </text>
            <text x="649" y="181">
              probes health
            </text>
            <path d="M160,272 H240" className="wf-main-edge" />
            <path d="M360,272 H440" className="wf-main-edge" />
            <text x="400" y="252" className="wf-fund-label">
              fund once
            </text>
            <path d="M560,272 H640" className="wf-main-edge" />
            <text x="600" y="252">
              earns per second
            </text>
            <path
              d="M100,368 C100,470 700,470 700,418"
              className="wf-reuse-edge"
            />
            {state.closed && !state.unverified && (
              <>
                <text x="375" y="402" className="wf-settlement-label">
                  ← {formatUsdc(state.refundedRaw)}
                </text>
                <text x="600" y="402" className="wf-settlement-label">
                  {formatUsdc(state.earnedRaw)} →
                </text>
              </>
            )}
            {state.packet && (
              <circle
                key={state.lastSeq}
                r="4"
                cx="300"
                cy="272"
                className={`wf-packet wf-packet-${state.packet.kind}`}
              />
            )}
          </svg>
          {hub}
          <div className="wf-nodes">
            {nodes.map(([id, label, Icon, caption]) => (
              <button
                type="button"
                key={id}
                className={`wf-node ${active(id) ? "is-active" : ""} ${
                  id === "service" && state.service === "outage"
                    ? "is-outage"
                    : ""
                }`}
                onClick={() => onNode(id)}
                aria-label={`Find ${label} events`}
              >
                {nodeBody(id, label, Icon, caption)}
              </button>
            ))}
          </div>
          <span
            key={state.successfulRequests}
            className="wf-call-count"
            title={
              idle
                ? "No run started; the call counter is reset to zero"
                : "Successful calls reported by the CLI. Zero transactions is shown only when nonce evidence is present."
            }
          >
            {calls}
          </span>
          {state.transaction && (
            <a
              className="wf-diagram-hash"
              href={state.transaction.explorerUrl}
              target="_blank"
              rel="noreferrer"
              title={`${state.transaction.kind}: ${state.transaction.status}`}
            >
              {shortAddress(state.transaction.hash)} ↗
            </a>
          )}
        </div>
        <div className="wf-mobile-stepper">
          {hub}
          <ol>
            {nodes.map(([id, label, Icon, caption]) => (
              <li key={id}>
                {id === "escrow" && <p className="wf-mobile-edge">fund once</p>}
                {id === "service" && (
                  <p className="wf-mobile-edge">earns per second</p>
                )}
                <button
                  type="button"
                  className={`wf-node ${active(id) ? "is-active" : ""} ${
                    id === "service" && state.service === "outage"
                      ? "is-outage"
                      : ""
                  }`}
                  onClick={() => onNode(id)}
                >
                  {nodeBody(id, label, Icon, caption)}
                </button>
              </li>
            ))}
          </ol>
          <span className="wf-mobile-calls">{calls}</span>
          {state.closed && !state.unverified && (
            <p>
              {formatUsdc(state.earnedRaw)} earned ·{" "}
              {formatUsdc(state.refundedRaw)} refunded
            </p>
          )}
        </div>
        {idle && mode === "recorded" && (
          <div className="wf-idle-action">
            <button
              type="button"
              className="btn-primary"
              disabled={replayDisabled}
              onClick={onReplay}
            >
              Replay recorded run
            </button>
          </div>
        )}
      </div>
      <div className="wf-trust">
        {[
          "CRE: local, deterministic",
          "Wallet CLI gates signing",
          "Contract does not verify CRE",
        ].map((label) => (
          <Link key={label} to="/docs/cre" title="Read the trust boundaries">
            <LockKeyhole size={11} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
