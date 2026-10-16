import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  ShieldX,
  Workflow,
  Globe,
  FileCheck2,
  Info,
  Download,
  RefreshCw,
  Terminal,
  CircleCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTokenUnits } from '../lib/token-units.mjs';
import { validateEvidence, formatDuration } from '../lib/evidence.mjs';
import CopyButton from '../components/ui/CopyButton';

const price = (value) => `$${formatTokenUnits(value, 8)}`;
const units = (value) => `${formatTokenUnits(value, 6)} USDC`;
const capturedTime = (value) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC';
function Observation({
  icon: Icon,
  step,
  label,
  value,
  children,
  href,
  linkLabel,
}) {
  return (
    <section className="panel flex min-w-0 flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Icon size={16} className="text-blue-300" aria-hidden="true" />
          {label}
        </span>
        <span className="text-xs font-mono text-slate-500">{step}</span>
      </div>
      <h3 className="mt-5 break-words text-xl font-semibold text-white">
        {value}
      </h3>
      <div className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
        {children}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm text-blue-300 hover:text-blue-200"
        >
          {linkLabel}
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
export default function CREWorkflow() {
  const [scenario, setScenario] = useState('allow');
  const [capture, setCapture] = useState({
    scenario: null,
    evidence: null,
    error: '',
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    fetch(`${import.meta.env.BASE_URL}evidence/cre-${scenario}.json`, {
      signal: controller.signal,
      cache: 'no-cache',
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(
            'The saved execution could not be loaded. Check your connection and retry.'
          );
        return response.json().catch(() => {
          throw new Error(
            'The saved execution is missing or unreadable. Restore the evidence file and retry.'
          );
        });
      })
      .then((data) => {
        validateEvidence(data, scenario);
        if (active) setCapture({ scenario, evidence: data, error: '' });
      })
      .catch((error) => {
        if (active && (timedOut || error.name !== 'AbortError'))
          setCapture({
            scenario,
            evidence: null,
            error: timedOut
              ? 'Loading took too long. Check your connection and retry.'
              : error.message,
          });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [scenario, attempt]);
  const evidence = capture.scenario === scenario ? capture.evidence : null;
  const error = capture.scenario === scenario ? capture.error : '';
  const result = evidence?.result;
  const command = `npm run cre:simulate${
    scenario === 'deny-budget' ? ' -- --deny-budget' : ''
  }`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="eyebrow flex items-center gap-2">
            <Workflow size={15} aria-hidden="true" />
            Chainlink Runtime Environment
          </p>
          <h1 className="page-title mt-3">Guarded USDC payments.</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            CRE checks USDC prices, the peg, and a spending cap before an agent
            pays. Inspect real CLI decisions below.
          </p>
        </div>
        <a
          className="btn-outline hidden shrink-0 sm:inline-flex"
          href="https://github.com/ola-893/agentPay/tree/main/cre/payment-guard"
          target="_blank"
          rel="noreferrer"
        >
          Workflow source <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-white/10 py-3 text-xs text-slate-300">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Ethereum Sepolia
        </span>
        <span>Circle USDC · 6 decimals</span>
        <span>Coinbase + Chainlink USDC/USD</span>
      </div>
      <section aria-labelledby="executions-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="executions-title" className="text-lg font-semibold">
              Recorded executions
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Real CRE CLI captures. Select a request to inspect.
            </p>
          </div>
          <div
            className="inline-flex w-full rounded-xl border border-white/10 bg-[#111827] p-1 sm:w-auto"
            role="group"
            aria-label="Execution scenario"
          >
            {[
              ['allow', 'Within budget'],
              ['deny-budget', 'Over budget'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={scenario === value}
                onClick={() => setScenario(value)}
                className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors sm:flex-none ${
                  scenario === value
                    ? 'bg-blue-500/20 text-blue-100'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <div role="alert" className="panel p-6">
            <h3 className="font-semibold">Evidence unavailable</h3>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <button
              type="button"
              className="btn-outline mt-4"
              onClick={() => {
                setCapture({ scenario: null, evidence: null, error: '' });
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        ) : !result ? (
          <div className="panel min-h-64 animate-pulse p-6" role="status">
            <p className="text-sm text-slate-400">
              Loading recorded execution…
            </p>
            <div className="mt-6 h-12 w-40 rounded-lg bg-white/5" />
            <div className="mt-8 h-14 rounded-lg bg-white/5" />
          </div>
        ) : (
          <div
            className={`panel overflow-hidden ${
              result.approved ? 'border-emerald-400/25' : 'border-amber-400/25'
            }`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6 ${
                result.approved ? 'bg-emerald-500/[.06]' : 'bg-amber-500/[.06]'
              }`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    result.approved
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {result.approved ? (
                    <ShieldCheck size={26} />
                  ) : (
                    <ShieldX size={26} />
                  )}
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-slate-400">
                    Simulation decision
                  </p>
                  <h3 className="mt-0.5 text-2xl font-semibold">
                    {result.approved ? 'ALLOW' : 'DENY'}
                    <span className="mt-1 block text-sm font-normal text-slate-300 sm:ml-3 sm:mt-0 sm:inline">
                      {result.approved
                        ? 'Within spending cap'
                        : 'Spending cap exceeded'}
                    </span>
                  </h3>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                <span className="block">
                  Captured {capturedTime(evidence.capturedAt)}
                </span>
                <span className="mt-1 block font-mono">{result.reason}</span>
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 sm:gap-6 sm:p-6">
              <div>
                <dt className="text-sm text-slate-400">Requested payment</dt>
                <dd className="mt-2 break-words text-2xl font-semibold tracking-tight">
                  {units(result.request.amount)}
                </dd>
                <dd className="mt-1 text-xs text-slate-400">
                  {result.request.amount} raw units
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Per-request cap</dt>
                <dd className="mt-2 text-2xl font-semibold tracking-tight">
                  {units(result.request.spendingCap)}
                </dd>
                <dd className="mt-1 text-xs text-slate-400">
                  {result.request.spendingCap} raw units
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-sm text-slate-400">Report status</dt>
                <dd className="mt-2 flex items-center gap-2 text-lg font-medium">
                  <FileCheck2 size={18} className="text-blue-300" />
                  Preview only
                </dd>
                <dd className="mt-2 text-xs text-slate-400">
                  Not published · No funds moved
                </dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 border-t border-white/10 px-5 py-3 text-xs leading-relaxed text-slate-400 sm:px-6">
              <Info size={15} className="mt-0.5 shrink-0" />
              Historical evidence, not an active authorization. A fresh
              authenticated report is required before settlement.
            </p>
          </div>
        )}
      </section>
      {result && (
        <>
          <section aria-labelledby="observations-title">
            <h2 id="observations-title" className="mb-4 text-lg font-semibold">
              What CRE checked
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Observation
                icon={Globe}
                step="01"
                label="External price"
                value={price(result.externalPriceUsd8)}
                href={result.marketApiUrl}
                linkLabel="Coinbase API"
              >
                <p>USDC/USD spot quote, aggregated with CRE HTTP consensus.</p>
              </Observation>
              <Observation
                icon={Workflow}
                step="02"
                label="Onchain price"
                value={price(result.chainlinkPriceUsd8)}
                href={`https://sepolia.etherscan.io/address/${result.feedAddress}`}
                linkLabel="Chainlink feed"
              >
                <p>
                  Finalized Sepolia read. Feed age at execution:{' '}
                  {formatDuration(result.observedAt - result.feedUpdatedAt)}.
                </p>
              </Observation>
              <Observation
                icon={ShieldCheck}
                step="03"
                label="Risk policy"
                value={`${(
                  (Math.abs(
                    Number(result.externalPriceUsd8) -
                      Number(result.chainlinkPriceUsd8)
                  ) /
                    Number(result.chainlinkPriceUsd8)) *
                  100
                ).toFixed(3)}% disagreement`}
              >
                <ul className="space-y-2">
                  <li>Source disagreement ≤ {result.maxDeviationBps / 100}%</li>
                  <li>
                    Each price within {result.maxPegDeviationBps / 100}% of $1
                  </li>
                  <li>Feed age ≤ {formatDuration(result.maxFeedAgeSeconds)}</li>
                  <li>Payment within its cap</li>
                </ul>
              </Observation>
              <Observation
                icon={FileCheck2}
                step="04"
                label="Bounded report"
                value="Report generated"
                href="https://github.com/ola-893/agentPay/blob/main/contracts/AgentPayGuard.sol"
                linkLabel="Inspect guard"
              >
                <p>
                  Binds the parties, token, amount, chain, receiver, request ID,
                  and expiry.
                </p>
                <p className="mt-2">
                  {result.validUntil - result.observedAt}s lifetime from
                  observation.
                </p>
              </Observation>
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <section className="panel min-w-0 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <Terminal size={17} className="text-blue-300" />
                Reproduce this execution
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Run the selected scenario locally. Install CRE and Bun, then
                authenticate with{' '}
                <code className="text-slate-200">cre login</code>.
              </p>
              <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#0b101c] p-3">
                <code className="min-w-0 flex-1 break-all text-sm text-blue-200">
                  {command}
                </code>
                <CopyButton value={command} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Before recording, run{' '}
                <code className="text-slate-200">npm run cre:dry-run</code> for
                both scenarios and freshness headroom. Live inputs can change
                the decision.
              </p>
              <Link
                to="/docs/setup"
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-blue-300"
              >
                Setup instructions <ArrowRight size={15} />
              </Link>
            </section>
            <section className="panel p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <CircleCheck size={17} className="text-blue-300" />
                The payment asset matches the policy
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Circle Sepolia USDC uses 6 decimals: 0.01 USDC = 10000 raw
                units. Both prices must stay near $1, even if they agree with
                each other.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Testnet USDC has no monetary value. The 24-hour feed limit
                models risk and does not promise immediate depeg detection.
                Legacy tUSD streams are separate.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5">
                <a
                  href={`https://sepolia.etherscan.io/token/${result.request.token}`}
                  className="inline-flex min-h-11 items-center gap-1 text-sm text-blue-300"
                  target="_blank"
                  rel="noreferrer"
                >
                  Circle USDC <ArrowUpRight size={15} />
                </a>
                <a
                  href="https://faucet.circle.com/"
                  className="inline-flex min-h-11 items-center gap-1 text-sm text-blue-300"
                  target="_blank"
                  rel="noreferrer"
                >
                  Test USDC faucet <ArrowUpRight size={15} />
                </a>
              </div>
            </section>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-300"
              href={`${import.meta.env.BASE_URL}evidence/cre-${scenario}.json`}
              download
            >
              <Download size={16} />
              Download result JSON
            </a>
            <a
              className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-300"
              href={`https://github.com/ola-893/agentPay/blob/main/docs/evidence/cre-${scenario}.log`}
              target="_blank"
              rel="noreferrer"
            >
              CLI transcript <ArrowUpRight size={15} />
            </a>
            <a
              className="inline-flex min-h-11 items-center gap-1 text-sm text-blue-300 sm:hidden"
              href="https://github.com/ola-893/agentPay/tree/main/cre/payment-guard"
              target="_blank"
              rel="noreferrer"
            >
              Workflow source <ArrowUpRight size={15} />
            </a>
          </div>
          <details className="panel min-w-0 p-5">
            <summary className="cursor-pointer rounded-lg text-sm font-medium text-slate-300">
              Raw result & evidence hashes
            </summary>
            <pre
              tabIndex={0}
              aria-label="Captured execution JSON"
              className="mt-4 max-h-80 overflow-auto rounded-xl bg-[#0b101c] p-4 text-xs leading-relaxed text-slate-300"
            >
              {JSON.stringify(evidence, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
