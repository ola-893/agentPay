import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, Workflow } from 'lucide-react';

const sections = [
  ['overview', 'AgentPay overview'], ['cre', 'CRE workflow'], ['integration', 'Agent integration'], ['setup', 'Run locally'],
];
const content = {
  overview: { title: 'Agent payments with deliberate control.', intro: 'AgentPay connects a Chainlink CRE workflow to an onchain payment guard and a TypeScript agent client.', paragraphs: [
    'The workflow fetches Coinbase ETH/USD, reads a finalized Chainlink ETH/USD feed on Ethereum Sepolia, and checks data freshness, price deviation, and a per-request token spending cap. This is a market-sanity circuit breaker, rather than a valuation of the payment token.',
    'The dashboard shows captured CLI evidence for an allowed request and an over-budget rejection. It does not submit transactions or turn simulation output into payment authority.',
    'The original streaming tools remain available as a separate feature. The new guarded settlement path requires a fresh onchain CRE authorization. The demo token is MockUSD (tUSD), with 18 decimals and no monetary value.'
  ] },
  cre: { title: 'One workflow. Two independent observations.', intro: 'CRE is the orchestration layer that joins an external API, onchain state, policy evaluation, and report generation.', paragraphs: [
    'A cron trigger starts the workflow. CRE HTTPClient fetches the Coinbase spot price using median aggregation. EVMClient reads decimals and latestRoundData from the Chainlink feed at a finalized block. The policy evaluates integer values and denies stale, incomplete, divergent, or over-budget observations.',
    'An ABI-encoded report binds chain ID, receiver contract, single-use request ID, agent, recipient, token, amount, and expiry. The checked-in configuration uses placeholder payment parties and a zero receiver for simulation preview only.',
    'For deployed use, configure real parties and a deployed AgentPayGuard, enable report publication, and deploy the workflow through CRE. The guard accepts reports only from its immutable trusted forwarder and owner-configured workflow ID. It rejects reports for another chain or receiver and prevents duplicate reports and payment reuse.',
    'CRE simulation is not a live DON deployment. The simulator’s mock forwarder does not supply production workflow metadata. The guard intentionally keeps identity checks enabled, so the recorded simulation does not publish to it. Consumer and settlement behavior is verified by local contract tests.'
  ], code: 'npm run install:cre\ncre login\nnpm run cre:simulate\nnpm run cre:simulate -- --deny-budget' },
  integration: { title: 'Authorize first. Approve tokens second.', intro: 'Use GuardedPaymentClient for the CRE-controlled payment path.', paragraphs: [
    'An agent receives a unique request ID after the workflow report has been accepted onchain. Construct the client with a connected ethers signer, the deployed guard and settlement addresses, and the expected chain ID.',
    'The client verifies the chain, settlement-to-guard binding, and live authorization before any token approval. It checks authorization again after approval and waits for confirmed settlement. The contract enforces the final bounds and consumes the request ID atomically with token transfer.',
    'The guard cap is per request, not a rolling daily budget or KYC/compliance check. The original AgentPaySDK stream negotiation is separate from this guarded path. A browser evidence JSON or an expired simulation decision is never a credential.'
  ], code: "import { GuardedPaymentClient } from './sdk/src';\n\nconst client = new GuardedPaymentClient(signer, {\n  guardAddress, settlementAddress, chainId: 11155111\n});\nawait client.pay(requestId, recipient, token, amountInTokenUnits);" },
  setup: { title: 'Reproduce the evidence.', intro: 'Use Node.js 22+, Bun 1.2.21+, and the authenticated Chainlink CRE CLI.', paragraphs: [
    'Install the root, SDK, server and frontend dependencies with npm run install:all, and the workflow dependencies with npm run install:cre. The read-only workflow simulation needs internet access to CRE, Coinbase and a Sepolia RPC. It does not need your wallet key or testnet funds.',
    'Run npm run cre:simulate for the normal request, or add -- --deny-budget for the rejection scenario. The capture command saves the successful CLI transcript and result for the frontend and submission evidence. If external inputs violate policy, the command fails instead of manufacturing an ALLOW result.',
    'Wallet streams require your own newly deployed token and stream contracts in vite-project/.env.local. The included .env.example lists server and deployment settings. Run npm test, npm run build:web, npm --prefix sdk run build, and npm --prefix vite-project run lint before submitting.'
  ], code: 'npm run install:all\nnpm run install:cre\ncre login\nnpm run cre:capture\nnpm run cre:capture -- --deny-budget\nnpm run dev' },
};

export default function Docs() {
  const { section = 'overview' } = useParams();
  const page = content[section] || content.overview;
  return <div className="min-h-screen max-w-6xl mx-auto px-5 py-10 text-white">
    <Link to="/" className="inline-flex items-center gap-2 text-blue-300 text-sm"><ArrowLeft size={16} /> AgentPay</Link>
    <div className="mt-10 grid gap-10 md:grid-cols-[220px_1fr]">
      <aside><p className="flex gap-2 text-sm font-semibold text-white/80"><BookOpen size={18} /> Documentation</p><nav aria-label="Documentation" className="mt-5 flex flex-col gap-2">{sections.map(([key, label]) => <Link key={key} to={`/docs/${key}`} className={`rounded-xl px-4 py-3 text-sm ${page === content[key] ? 'bg-blue-500/15 text-blue-200' : 'text-white/50 hover:bg-white/5'}`}>{label}</Link>)}</nav><a href="https://docs.chain.link/cre" className="mt-6 inline-flex items-center gap-2 text-sm text-blue-300" target="_blank" rel="noreferrer">Chainlink CRE docs <ArrowUpRight size={15} /></a></aside>
      <article className="max-w-3xl"><p className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-blue-400"><Workflow size={16} /> AgentPay / Chainlink CRE</p><h1 className="mt-4 text-4xl font-bold tracking-tight leading-tight">{page.title}</h1><p className="mt-5 text-lg leading-relaxed text-white/75">{page.intro}</p><div className="mt-8 space-y-5 text-white/55 leading-relaxed">{page.paragraphs.map(text => <p key={text}>{text}</p>)}</div>{page.code && <pre className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5 overflow-auto text-sm text-blue-200 leading-relaxed">{page.code}</pre>}<a href="https://github.com/ola-893/agentPay/blob/main/docs/CRE_SUBMISSION.md" className="mt-8 inline-flex gap-2 items-center text-sm text-blue-300" target="_blank" rel="noreferrer">Submission guide and evidence <ArrowUpRight size={16} /></a></article>
    </div>
  </div>;
}
