import { useState } from "react";
import { Link } from "react-router-dom";
import { isAddress, ZeroAddress, parseUnits } from "ethers";
import {
  Bot,
  FileCode2,
  Save,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import CopyButton from "../components/ui/CopyButton";
import { guardedExample } from "../lib/guarded-example.mjs";

const empty = {
  agentName: "AgentPay agent",
  guard: "",
  settlement: "",
  recipient: "",
  amount: "0.01",
};
const storageKey = "agentpay:guarded-agent-draft:v1";
const addressOK = (value) => isAddress(value) && value !== ZeroAddress;
export default function AgentConsolePage() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved?.version === 1 &&
        Object.keys(empty).every((k) => typeof saved.config?.[k] === "string")
        ? saved.config
        : empty;
    } catch {
      return empty;
    }
  });
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = {};
  if (!config.agentName.trim()) errors.agentName = "Give this draft a name.";
  for (const field of ["guard", "settlement", "recipient"])
    if (!addressOK(config[field]))
      errors[field] = "Enter a nonzero Ethereum address.";
  let rawAmount = null;
  try {
    rawAmount = parseUnits(config.amount, 6);
    if (rawAmount <= 0n || rawAmount >= 2n ** 256n) throw new Error();
  } catch {
    errors.amount = "Use a positive USDC amount with up to 6 decimal places.";
  }
  const valid = !Object.keys(errors).length;
  const update = (field, value) => {
    setConfig((c) => ({ ...c, [field]: value }));
    setNotice("");
    setSaved(false);
  };
  const save = (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) {
      setNotice("Check the highlighted fields before saving.");
      document.getElementById(`agent-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, config }));
      setSaved(true);
      setNotice(
        "Draft saved in this browser. No onchain policy or running agent was changed."
      );
    } catch {
      setNotice(
        "Browser storage is unavailable. You can still copy the integration example."
      );
    }
  };
  const reset = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Storage may be unavailable. */
    }
    setConfig(empty);
    setSubmitted(false);
    setSaved(false);
    setNotice("Draft cleared.");
  };
  const code = valid ? guardedExample(config, rawAmount) : null;
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow flex items-center gap-2">
          <Bot size={15} />
          Agent integration
        </p>
        <h1 className="page-title mt-3">Prepare your agent.</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
          Run the AI CLI to see CRE supervise a USDC payment stream, or prepare
          the separate strict-settlement SDK draft below. No wallet or private
          key is needed to edit this draft.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Payment configuration</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Use your configured strict guard and settlement contracts. Saved
            simulation results cannot authorize a payment.
          </p>
          <form onSubmit={save} noValidate className="mt-6 space-y-5">
            {[
              ["agentName", "Draft name", "My payment agent"],
              ["guard", "Guard address", "0x…"],
              ["settlement", "Settlement address", "0x…"],
              ["recipient", "Payment recipient", "0x…"],
              ["amount", "Payment amount (USDC)", "0.01"],
            ].map(([field, label, placeholder]) => (
              <div key={field}>
                <label htmlFor={`agent-${field}`} className="field-label">
                  {label}
                </label>
                <input
                  id={`agent-${field}`}
                  className={`input-default ${
                    field !== "agentName" ? "font-mono text-sm" : ""
                  }`}
                  value={config[field]}
                  placeholder={placeholder}
                  onChange={(e) => update(field, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  inputMode={field === "amount" ? "decimal" : "text"}
                  maxLength={
                    field === "agentName" ? 80 : field === "amount" ? 90 : 42
                  }
                  aria-invalid={submitted && Boolean(errors[field])}
                  aria-describedby={
                    submitted && errors[field] ? `error-${field}` : undefined
                  }
                />
                {submitted && errors[field] && (
                  <p
                    id={`error-${field}`}
                    className="mt-2 text-sm text-amber-200"
                  >
                    {errors[field]}
                  </p>
                )}
              </div>
            ))}
            <p className="text-xs text-slate-400">
              Circle USDC · 6 decimals · Ethereum Sepolia only
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary">
                {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                {saved ? "Draft saved" : "Save local draft"}
              </button>
              <button type="button" onClick={reset} className="btn-outline">
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
            <p role="status" className="text-sm leading-relaxed text-slate-300">
              {notice}
            </p>
          </form>
        </section>
        <div className="min-w-0 space-y-4">
          <section className="panel min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <FileCode2 size={17} className="text-blue-300" />
                SDK integration
              </h2>
              {code && (
                <CopyButton value={code} label="Copy agent integration code" />
              )}
            </div>
            {code ? (
              <pre
                tabIndex={0}
                aria-label="Generated integration code"
                className="max-w-full overflow-auto p-5 text-xs leading-6 text-blue-200"
              >
                <code>{code}</code>
              </pre>
            ) : (
              <div className="p-6">
                <p className="text-sm leading-relaxed text-slate-400">
                  Enter valid contract and recipient addresses to generate an
                  example with the exact USDC raw-unit amount.
                </p>
                <div className="mt-5 space-y-3" aria-hidden="true">
                  <div className="h-3 w-4/5 rounded bg-white/5" />
                  <div className="h-3 w-3/5 rounded bg-white/5" />
                  <div className="h-3 w-2/3 rounded bg-white/5" />
                </div>
              </div>
            )}
          </section>
          <div className="panel p-5">
            <h2 className="font-semibold">
              This SDK draft uses strict settlement
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              The streaming demo runs CRE locally and uses the payer wallet to
              fund or cancel escrow. This separate SDK example requires an
              authenticated onchain report; local simulation cannot unlock it.
              The public strict guard remains closed.
            </p>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-400">
              <li>
                Configure strict guard and settlement contracts with an
                authenticated report source.
              </li>
              <li>
                Have the guard accept a fresh authenticated report for this
                payment intent.
              </li>
              <li>
                Use the SDK with a connected Sepolia signer. It checks
                authorization before token approval and settlement.
              </li>
            </ol>
            <Link
              to="/docs/agent"
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-blue-300"
            >
              Run the local CRE streaming demo <ArrowRight size={15} />
            </Link>
            <Link
              to="/docs/integration"
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-blue-300"
            >
              Read the integration guide <ArrowRight size={15} />
            </Link>
          </div>
          <p className="px-1 text-xs leading-relaxed text-slate-400">
            This page saves a browser draft. It does not start an agent, change
            a spending cap, or pause a deployed workflow.
          </p>
        </div>
      </div>
    </div>
  );
}
