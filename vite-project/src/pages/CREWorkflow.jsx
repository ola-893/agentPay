import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, CheckCircle2, Copy, Download, ExternalLink, FileCheck2, Globe, Loader2, ShieldCheck, ShieldX, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTokenUnits } from '../lib/token-units.mjs';

const money = value => `$${formatTokenUnits(value, 8)}`;
const units = (value, result) => `${formatTokenUnits(value, result.tokenDecimals)} ${result.tokenSymbol}`;

function Observation({ icon: Icon, label, title, children }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40"><Icon size={15} />{label}</div><h3 className="mt-4 text-lg font-semibold text-white">{title}</h3><div className="mt-2 text-sm leading-relaxed text-white/55">{children}</div></div>;
}

export default function CREWorkflow() {
  const [scenario, setScenario] = useState('allow');
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setEvidence(null); setError(''); setCopied(false);
    fetch(`${import.meta.env.BASE_URL}evidence/cre-${scenario}.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Simulation evidence is unavailable. Run npm run cre:capture to generate it.'); return response.json(); })
      .then(data => { if (data.result?.workflow !== 'agentpay-payment-guard' || data.result.schemaVersion !== 2 || data.result.tokenSymbol !== 'USDC' || data.result.tokenDecimals !== 6 || data.scenario !== scenario) throw new Error('Expected current six-decimal USDC evidence. Run npm run cre:capture for both scenarios.'); setEvidence(data); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [scenario]);
  const result = evidence?.result;
  const command = `npm run cre:simulate${scenario === 'deny-budget' ? ' -- --deny-budget' : ''}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setCopied(true); }
    catch { setError('Clipboard unavailable. Select and copy the command below.'); }
  };

  return (
    <div className="space-y-7 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-400">Orchestration / Payment Guard</p><h2 className="mt-2 text-3xl font-bold text-white">See why an agent can pay.</h2><p className="mt-3 max-w-2xl text-white/55">A real CRE CLI execution joins an external API and Ethereum Sepolia. Every decision has inspectable inputs.</p></div>
        <a className="btn-outline inline-flex items-center gap-2 text-sm" href="https://github.com/ola-893/agentPay/tree/main/cre/payment-guard" target="_blank" rel="noreferrer">Workflow source <ArrowUpRight size={16} /></a>
      </div>

      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 px-5 py-4 text-sm text-blue-200/80"><strong>Recorded simulation evidence.</strong> These observations were captured by the CRE CLI, rather than fetched live by this page. No payment was sent and no workflow is deployed. A saved ALLOW result cannot authorize spending.</div>

      <div className="rounded-2xl border border-white/10 px-5 py-4"><h3 className="font-semibold text-white">USDC payments. USDC/USD policy.</h3><p className="mt-2 text-sm leading-relaxed text-white/55">The guarded path uses Circle’s six-decimal Sepolia USDC. CRE compares Coinbase and Chainlink USDC/USD, checks each price against $1, and rejects stale or over-budget requests. Sepolia USDC has no monetary value; these USD observations model payment-asset risk. Legacy tUSD streams remain separate.</p><a href="https://faucet.circle.com/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-300">Get test USDC from Circle <ExternalLink size={12} /></a></div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Simulation scenario">
        {[['allow', 'Within budget'], ['deny-budget', 'Over budget']].map(([value, label]) => <button key={value} type="button" aria-pressed={scenario === value} onClick={() => setScenario(value)} className={`rounded-xl px-5 py-3 text-sm font-medium border transition-colors ${scenario === value ? 'border-blue-400/50 bg-blue-500/15 text-blue-200' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>{label}</button>)}
      </div>

      {error && <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">{error}</p>}
      {!result && !error && <div className="flex items-center gap-3 text-white/50 p-8" role="status"><Loader2 className="animate-spin" size={20} /> Loading captured CLI evidence…</div>}
      {result && <>
        <div className={`rounded-2xl border p-6 md:p-8 ${result.approved ? 'border-emerald-400/20 bg-emerald-500/[0.04]' : 'border-amber-400/20 bg-amber-500/[0.04]'}`}>
          <div className="flex flex-wrap justify-between gap-5">
            <div className="flex items-start gap-4">{result.approved ? <ShieldCheck className="text-emerald-400 mt-1" size={32} /> : <ShieldX className="text-amber-400 mt-1" size={32} />}<div><p className={`text-xs font-medium uppercase tracking-widest ${result.approved ? 'text-emerald-400' : 'text-amber-400'}`}>Simulation decision</p><h3 className="mt-1 text-3xl font-bold text-white">{result.approved ? 'ALLOW' : 'DENY'}</h3><p className="mt-2 font-mono text-xs text-white/50">{result.reason}</p></div></div>
            <div className="text-sm text-white/50 md:text-right"><p className="text-white/75">Ethereum Sepolia · Chain {result.chainId}</p><p className="mt-1">Captured {new Date(evidence.capturedAt).toLocaleString()}</p><p className="mt-1">Authorization window: {result.validUntil - result.observedAt} seconds from observation</p></div>
          </div>
          <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
            <div><p className="text-xs text-white/40">Requested payment</p><p className="mt-1 text-xl font-semibold text-white">{units(result.request.amount, result)}</p><p className="mt-1 text-xs text-white/40">{result.request.amount} raw units · {result.tokenDecimals} decimals</p></div>
            <div><p className="text-xs text-white/40">Per-request policy cap</p><p className="mt-1 text-xl font-semibold text-white">{units(result.request.spendingCap, result)}</p><a className="mt-1 inline-flex items-center gap-1 text-xs text-blue-300" href={`https://sepolia.etherscan.io/token/${result.request.token}`} target="_blank" rel="noreferrer">Circle Sepolia USDC <ExternalLink size={12} /></a></div>
            <div><p className="text-xs text-white/40">Publication</p><p className="mt-1 text-xl font-semibold text-white">{result.published ? 'Submitted onchain' : 'Preview only'}</p></div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Observation icon={Globe} label="01 / External API" title={money(result.externalPriceUsd8)}><p>Coinbase USDC/USD spot quote, aggregated through CRE HTTP consensus.</p><a href={result.marketApiUrl} className="mt-3 inline-flex items-center gap-1 text-blue-300" target="_blank" rel="noreferrer">Inspect endpoint <ExternalLink size={12} /></a></Observation>
          <Observation icon={Workflow} label="02 / Onchain read" title={money(result.chainlinkPriceUsd8)}><p>Chainlink USDC/USD on Sepolia. Finalized contract reads; {result.observedAt - result.feedUpdatedAt}s old at execution. Freshness headroom at capture: {result.maxFeedAgeSeconds - (result.observedAt - result.feedUpdatedAt)}s. Maximum age: {result.maxFeedAgeSeconds}s.</p><a href={`https://sepolia.etherscan.io/address/${result.feedAddress}`} className="mt-3 inline-flex items-center gap-1 text-blue-300" target="_blank" rel="noreferrer">Inspect feed <ExternalLink size={12} /></a></Observation>
          <Observation icon={CheckCircle2} label="03 / Policy" title={`${(Math.abs(Number(result.externalPriceUsd8) - Number(result.chainlinkPriceUsd8)) / Number(result.chainlinkPriceUsd8) * 100).toFixed(3)}% disagreement`}><p>Maximum disagreement: {result.maxDeviationBps / 100}%. Each source must also stay within {result.maxPegDeviationBps / 100}% of $1. Freshness, completed round, and payment cap use integer arithmetic.</p></Observation>
          <Observation icon={FileCheck2} label="04 / CRE report" title={result.reportGenerated ? 'Report generated' : 'No report'}><p>The report binds the payment parties, token, amount, chain, receiver, request ID, and expiry. This run did not publish it.</p></Observation>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-white/10 p-6"><h3 className="font-semibold text-white">Reproduce this execution</h3><p className="mt-2 text-sm text-white/50">Install CRE and Bun, run <code className="text-blue-200">npm run install:cre</code>, and log in with <code className="text-blue-200">cre login</code>. Before recording, run <code className="text-blue-200">npm run cre:dry-run</code> to check both scenarios and ten minutes of freshness headroom. Keep the saved transcripts as backup.</p><div className="mt-4 flex items-center gap-3 rounded-xl bg-black/25 p-4"><code className="flex-1 break-all text-sm text-blue-200">{command}</code><button type="button" onClick={copy} aria-label="Copy simulation command" className="p-2 rounded-lg hover:bg-white/10 text-white/60">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div><p className="mt-3 text-xs text-white/40" role="status">{copied ? 'Command copied.' : 'Requires network access. Future market observations can change the decision.'}</p></div>
          <div className="rounded-2xl border border-white/10 p-6"><h3 className="font-semibold text-white">From a decision to a payment</h3><p className="mt-2 text-sm leading-relaxed text-white/50">For settlement, a deployed CRE workflow submits its signed report through a trusted forwarder. AgentPayGuard verifies its origin and bounds. The SDK then checks the onchain authorization before approving tokens.</p><Link to="/docs/cre" className="mt-4 inline-flex items-center gap-2 text-sm text-blue-300">Read the trust boundaries <ArrowUpRight size={16} /></Link></div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm"><a className="inline-flex items-center gap-2 text-blue-300" href={`${import.meta.env.BASE_URL}evidence/cre-${scenario}.json`} download><Download size={16} /> Download captured result</a><a className="inline-flex items-center gap-2 text-blue-300" href={`https://github.com/ola-893/agentPay/blob/main/docs/evidence/cre-${scenario}.log`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Read CLI transcript</a></div>
        <details className="rounded-2xl border border-white/10 p-5"><summary className="cursor-pointer text-sm text-white/65">Inspect the complete result and evidence hashes</summary><pre className="mt-4 overflow-auto max-h-96 rounded-xl bg-black/25 p-4 text-xs leading-relaxed text-blue-100/70">{JSON.stringify(evidence, null, 2)}</pre></details>
      </>}
    </div>
  );
}
