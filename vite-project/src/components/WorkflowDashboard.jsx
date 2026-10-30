import { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import useWorkflowRun from "../hooks/useWorkflowRun";
import WorkflowDiagram from "./WorkflowDiagram";
import WorkflowTimeline from "./WorkflowTimeline";
import WorkflowRunStatus from "./WorkflowRunStatus";
import { Address } from "./WorkflowBits";
import CopyButton from "./ui/CopyButton";
import {
  deriveDiagramState,
  eventNodes,
  recordingChoices,
  recordingScenario,
  recordingLabel,
  formatEth,
  formatUsdc,
  toRawUsdc,
} from "../lib/workflow-view.mjs";
import { formatTokenUnits } from "../lib/token-units.mjs";
const scenarios = { "tiny-cap": "Cap DENY", "stale-feed": "Stale DENY" };
function AmountInput({ raw, onChange, label, max, disabled }) {
  const [text, setText] = useState(() => (raw ? formatTokenUnits(raw, 6) : ""));
  const [error,setError] = useState("");
  const emitted = useRef(raw);
  const input = useRef(null);
  useEffect(() => {
    if (raw !== emitted.current) {
      setText(raw ? formatTokenUnits(raw, 6) : "");
      emitted.current = raw;
      input.current?.setCustomValidity("");
      setError("");
    }
  }, [raw]);
  return (
    <label className="wf-field">
      {label}
      <input
        ref={input}
        inputMode="decimal"
        type="text"
        value={text}
        title={`${raw || "Invalid"} raw units`}
        required
        onInvalid={(e) => {
          const details = e.currentTarget.closest("details");
          if (details) details.open = true;
        }}
        disabled={disabled}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          let next = "";
          try {
            next = toRawUsdc(value);
            if (BigInt(next) < 1n || BigInt(next) > BigInt(max))
              throw new Error(`Use 0.000001–${formatTokenUnits(max, 6)} USDC.`);
            e.target.setCustomValidity("");
            setError("");
          } catch (error) {
            next = "";
            e.target.setCustomValidity(error.message);
            setError(error.message);
          }
          emitted.current = next;
          onChange(next);
        }}
      />
      {error && <span className="wf-field-error" role="alert">{error}</span>}
    </label>
  );
}
function ControlCard({ c }) {
  const profile = c.profile;
  const recorded = c.mode === "recorded";
  const displayedPay = c.working && c.run.start ? c.run.start.mode === "pay" : c.pay;
  const policy = c.policy;
  const { primary, history } = recordingChoices(c.manifest);
  const selectedItem = c.manifest.find(item => item.id === c.selected);
  const runnerStatus = c.agent
    ? c.busy || (c.agent.busy && !c.run.summary)
      ? "busy"
      : "ready"
    : "offline";
  const runnerTitle =
    runnerStatus === "ready"
      ? "Local runner connected and ready"
      : runnerStatus === "busy"
      ? "Local runner is busy"
      : "Local runner not connected; start npm run dev:live";
  const setField = (key, value) => c.setPolicy({ ...policy, [key]: value });
  const runDisabled = recorded
    ? !c.recording
    : c.working ||
      Boolean(c.agent?.busy && !c.run.summary) ||
      !c.agent ||
      !policy?.depositCapRaw ||
      !policy?.maxRateRawPerSecond ||
      (c.pay && !c.confirmed);
  return (
    <aside className="wf-surface wf-controls">
      <div className="wf-agent-heading">
        <h2>{profile?.name || (recorded ? "Agent profile" : "Local agent")}</h2>
        <span className="wf-local-chip">
          {profile ? "Registered locally" : "Loading"}
        </span>
      </div>
      <Address value={profile?.payer} label="payer" />
      <div className="wf-balances">
        <span
          title={`${c.balances?.usdcRaw ?? "Unknown"} raw units; ${
            recorded ? "at recorded run start" : c.balances?.usdcSource || "observed at preflight"
          }`}
        >
          {formatUsdc(c.balances?.usdcRaw).replace(" USDC", "")}{" "}
          <small>test USDC</small>
        </span>
        <span title={`${c.balances?.ethRaw ?? "Unknown"} wei; ${recorded ? "at recorded run start" : c.balances?.ethSource || "observed at preflight"}`}>
          {formatEth(c.balances?.ethRaw)}
        </span>
      </div>
      <details className="wf-agent-details">
        <summary>Details</summary>
        {profile && (
          <div>
            {[
              ["Recipient", profile.recipient, "address"],
              ["Token", profile.token, "token"],
              ["Escrow", profile.escrow, "address"],
            ].map(([label, value, kind]) => (
              <div key={label}>
                <p>{label}</p>
                <Address value={value} label={label} kind={kind} full />
              </div>
            ))}
            <p>Planner: {recorded ? c.info?.planner : c.agent?.planner}</p>
            <p>
              Fixed quote: {formatUsdc(profile.quote.amountRaw)} /{" "}
              {profile.quote.durationSeconds}s. Premium attempt and outage are
              the CLI scenario.
            </p>
            <p>
              USDC balance is{" "}
              {recorded
                ? "historical run-start observations"
                : c.balances?.usdcSource || "observed at preflight"}
              . ETH is a preflight/run-start observation, truncated to four decimals.
            </p>
            {recorded && (
              <pre tabIndex={0}>{JSON.stringify(profile.policy, null, 2)}</pre>
            )}
          </div>
        )}
      </details>
      <div className="wf-mode" role="group" aria-label="Run mode">
        {["recorded", "live"].map((mode) => (
          <button
            type="button"
            key={mode}
            aria-pressed={c.mode === mode}
            disabled={c.busy}
            title={mode === "live" ? runnerTitle : "Replay captured runs"}
            onClick={() => c.changeMode(mode)}
          >
            {mode === "recorded" ? (
              "Recorded"
            ) : (
              <>
                <span
                  className={`wf-runner-dot is-${runnerStatus}`}
                  aria-hidden="true"
                />{" "}
                Live<span className="sr-only"> · Runner {runnerStatus}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {recorded ? (
        <>
          <div
            className="wf-scenarios wf-recorded-scenarios"
            role="group"
            aria-label="Recorded scenario"
          >
            {primary.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  title={item.label}
                  aria-pressed={Boolean(selectedItem && recordingScenario(selectedItem) === recordingScenario(item))}
                  disabled={c.playing}
                  onClick={() => c.setSelected(item.id)}
                >
                  {scenarios[item.preset] ||
                    (item.mode === "pay" ? "Funded run" : "Preview (no txs)")}
                </button>
              ))}
          </div>
          {history.length > 0 && (
            <label className="wf-history">
              Earlier captures
              <select
                aria-label="Recording history"
                disabled={c.playing}
                value={history.some(item => item.id === c.selected) ? c.selected : ""}
                onChange={e => c.setSelected(e.target.value || primary.find(item => recordingScenario(item) === recordingScenario(selectedItem || primary[0]))?.id || primary[0].id)}
              >
                <option value="">Latest scenario recording</option>
                {history.map(item => <option key={item.id} value={item.id}>{recordingLabel(item)}</option>)}
              </select>
            </label>
          )}
          <p className="wf-capture-date">
            {c.recording
              ? `Recorded ${new Date(
                  c.recording.item.capturedAt
                ).toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Loading captures…"}
          </p>
          <div className="wf-policy-used">
            <h3>
              <LockKeyhole size={12} aria-hidden="true" />
              Policy used
            </h3>
            <dl>
              {[
                ["Deposit cap", formatUsdc(policy?.depositCapRaw)],
                [
                  "Max rate",
                  policy
                    ? `${formatTokenUnits(
                        policy.maxRateRawPerSecond,
                        6
                      )} USDC/s`
                    : "—",
                ],
                [
                  "Max feed age",
                  policy
                    ? policy.maxFeedAgeSeconds % 3600 === 0
                      ? `${policy.maxFeedAgeSeconds / 3600} h`
                      : `${policy.maxFeedAgeSeconds} s`
                    : "—",
                ],
                ["Max failures", policy?.maxFailedRequests ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt
                    title={
                      label === "Max rate"
                        ? "Policy upper bound, not the stream's quoted rate"
                        : undefined
                    }
                  >
                    {label}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      ) : !c.agent ? (
        <div className="wf-offline">
          <p>Runner unavailable</p>
          <div className="wf-command">
            <code>npm run dev:live</code>
            <CopyButton value="npm run dev:live" className="wf-icon" />
          </div>
          <div className="wf-inline-actions">
            <Link to="/docs/setup">Local setup ↗</Link>
            {c.localDev && (
              <button
                type="button"
                onClick={c.connect}
                title="Check local runner"
              >
                <RefreshCw size={14} /> Retry
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <form
            id="wf-live-policy"
            onSubmit={c.start}
            className="wf-policy-form"
          >
            <div className="wf-policy-heading">
              <span>Policy</span>
              <button
                type="button"
                className="wf-icon"
                aria-label="Reset policy"
                disabled={c.working}
                onClick={() => {
                  c.setPolicy(c.agent.profile.policy);
                  c.setConfirmed(false);
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <AmountInput
              raw={policy?.depositCapRaw}
              onChange={(v) => setField("depositCapRaw", v)}
              label="Deposit cap · USDC"
              max="100000"
              disabled={c.working}
            />
            <div className="wf-field-pair">
              {[
                ["maxFeedAgeSeconds", "Feed age · seconds", 60, 86400],
                ["maxFailedRequests", "Failures", 1, 3],
              ].map(([key, label, min, max]) => (
                <label className="wf-field" key={key}>
                  {label}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step="1"
                    required
                    disabled={c.working}
                    value={policy?.[key] ?? ""}
                    onChange={(e) =>
                      setField(
                        key,
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <details className="wf-advanced-policy">
              <summary>Advanced</summary>
              <AmountInput
                raw={policy?.maxRateRawPerSecond}
                onChange={(v) => setField("maxRateRawPerSecond", v)}
                label="Max rate · USDC/s"
                max="100"
                disabled={c.working}
              />
              <div className="wf-field-pair">
                {[
                  ["maxPegDeviationBps", "Peg · bps"],
                  ["maxDeviationBps", "Disagreement · bps"],
                ].map(([key, label]) => (
                  <label className="wf-field" key={key}>
                    {label}
                    <input
                      type="number"
                      onInvalid={(e) => {
                        e.currentTarget.closest("details").open = true;
                      }}
                      min="1"
                      max="100"
                      step="1"
                      required
                      disabled={c.working}
                      value={policy?.[key] ?? ""}
                      onChange={(e) => setField(key, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </details>
            <div
              className="wf-scenarios"
              role="group"
              aria-label="Verified presets"
            >
              <button
                type="button"
                disabled={c.working}
                title="9999 raw USDC cap against the fixed 10000 request"
                onClick={() =>
                  c.setPolicy({
                    ...c.agent.profile.policy,
                    depositCapRaw: "9999",
                  })
                }
              >
                Tiny cap
              </button>
              <button
                type="button"
                disabled={c.working}
                title="60 second limit; outcome depends on the observed feed age"
                onClick={() =>
                  c.setPolicy({
                    ...c.agent.profile.policy,
                    maxFeedAgeSeconds: 60,
                  })
                }
              >
                Stale feed
              </button>
            </div>
            <div className="wf-mode" role="group" aria-label="Payment mode">
              <button
                type="button"
                aria-pressed={!displayedPay}
                disabled={c.working}
                onClick={() => {
                  c.setPay(false);
                  c.setConfirmed(false);
                }}
              >
                Preview
              </button>
              <button
                type="button"
                aria-pressed={displayedPay}
                disabled={c.working || !c.agent.payEnabled || !c.agent.payReady}
                title={
                  !c.agent.payEnabled
                    ? "Server PAY_ENABLED=1 required"
                    : !c.agent.payReady
                    ? "Needs 0.01 test USDC and 0.001 Sepolia ETH"
                    : "Escrows 0.01 test USDC plus gas"
                }
                onClick={() => {
                  c.setPay(true);
                  c.setConfirmed(false);
                }}
              >
                Pay
              </button>
            </div>
            {displayedPay && (
              <label className="wf-confirm">
                <input
                  type="checkbox"
                  required
                  disabled={c.working}
                  checked={c.confirmed || (c.working && c.run.start?.mode === "pay")}
                  onChange={(e) => c.setConfirmed(e.target.checked)}
                />
                Authorize 0.01 test USDC + gas.
              </label>
            )}
          </form>
        </>
      )}
      {!recorded && (
        <button
          type="submit"
          form="wf-live-policy"
          className="btn-primary wf-run-button"
          disabled={runDisabled}
        >
          <Play size={15} />{" "}
          {c.busy ? c.run.events.length ? "Running…" : "Starting…" : c.pay ? "Run Pay" : "Run Preview"}
        </button>
      )}
      {!recorded && (c.activeId || c.agent?.activeRunId) && (
        <button
          type="button"
          className="wf-reconnect"
          onClick={() => c.listen(c.activeId || c.agent.activeRunId)}
        >
          Reconnect timeline
        </button>
      )}
    </aside>
  );
}
export default function WorkflowDashboard() {
  const c = useWorkflowRun();
  return <WorkflowDashboardView c={c} />;
}
export function WorkflowDashboardView({ c }) {
  const [advanced, setAdvanced] = useState(false),
    [highlight, setHighlight] = useState([]),
    [jump, setJump] = useState(null);
  const state = useMemo(() => deriveDiagramState(c.run.events), [c.run.events]);
  const visible = c.run.events.filter(
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
  const replay = () => c.start({ preventDefault() {} });
  const findNode = (id) => {
    const event = visible.findLast((e) => eventNodes(e).includes(id));
    setHighlight([id]);
    if (event) setJump({ seq: event.seq, nonce: Date.now() });
  };
  const summary = state.summary;
  return (
    <div className="wf-grid">
      <ControlCard c={c} />
      <div className="wf-main">
        <WorkflowDiagram
          state={state}
          highlight={highlight}
          onNode={findNode}
          onReplay={replay}
          replayDisabled={!c.recording}
          mode={c.mode}
          guarded={state.status === "idle" ? c.info ? c.info.contractPolicySignatures === true : undefined : state.contractPolicySignatures}
        />
        <div className="wf-playback">
          <span className="wf-playback-label">
            {c.mode === "recorded"
              ? "Recorded replay"
              : c.busy
              ? "Live · running"
              : c.agent
              ? "Live · ready"
              : "Live · offline"}
          </span>
          <div>
            {c.mode === "recorded" && (
              <>
                <button
                  type="button"
                  className="wf-icon"
                  onClick={replay}
                  disabled={!c.recording}
                  aria-label={c.playing ? "Pause replay" : "Play replay"}
                  title={c.playing ? "Pause" : "Play"}
                >
                  {c.playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  type="button"
                  className="wf-icon"
                  onClick={c.step}
                  disabled={!c.recording || Boolean(c.run.summary)}
                  aria-label="Step one event"
                  title="Step"
                >
                  <SkipForward size={16} />
                </button>
                <button
                  type="button"
                  className="wf-icon"
                  onClick={c.restart}
                  disabled={!c.recording || !c.run.events.length}
                  aria-label="Restart replay"
                  title="Restart"
                >
                  <RotateCcw size={15} />
                </button>
              </>
            )}
          </div>
        </div>
        <WorkflowRunStatus state={state} />
        <div className="wf-summary" role="group" aria-label="Run summary">
          {summary ? (
            state.unverified ? (
              <span>Amounts unverified · inspect receipts.</span>
            ) : (
              <>
                <span>{formatUsdc(state.fundedRaw)} funded</span>
                <span>{formatUsdc(state.earnedRaw)} earned</span>
                <span>{formatUsdc(state.refundedRaw)} refunded</span>
                <span
                  title={`${state.transactions.length} payment lifecycle + ${state.auditReceipts.length} audit receipt transactions`}
                >
                  {state.transactions.length + state.auditReceipts.length} txs
                </span>
                <span>{state.successfulRequests ?? "—"} calls</span>
              </>
            )
          ) : (
            <span>
              {c.run.events.length
                ? `${c.run.events.length} events · ${
                    state.decision || "Running"
                  }`
                : c.busy ? "Checking local runner and wallet…" : "Waiting for events"}
            </span>
          )}
        </div>
        {c.error && (c.mode === "live" || !c.recording) && (
          <p className="wf-error" role="alert">
            {c.error}
          </p>
        )}
        <WorkflowTimeline
          currentEvent={c.run.events.at(-1)}
          events={visible}
          artifact={c.artifact}
          advanced={advanced}
          setAdvanced={setAdvanced}
          onHighlight={setHighlight}
          jump={jump}
        />
        <Link
          className="wf-scope"
          to="/docs/overview"
          title="Unaudited Sepolia prototype; test USDC has no monetary value; not the full x402 protocol"
        >
          Unaudited · Not full x402 ↗
        </Link>
      </div>
    </div>
  );
}
