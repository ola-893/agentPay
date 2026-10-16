import { Link } from 'react-router-dom';
import { ArrowUpRight, ShieldCheck, Workflow, Zap } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-12 md:py-20">
      <div className="relative overflow-hidden rounded-3xl border border-blue-400/20 bg-surface-800/80 p-8 md:p-14">
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <p className="mb-6 flex items-center gap-2 text-sm font-medium text-blue-300"><Workflow size={18} /> Built with Chainlink CRE</p>
        <h1 className="max-w-3xl text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white">Autonomous payments.<br /><span className="text-blue-400">Deliberate control.</span></h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60">AgentPay connects agent payments, external data, and onchain policy through the Chainlink Runtime Environment. Give agents the ability to pay, with boundaries you can inspect.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/docs" className="btn-primary inline-flex items-center gap-2">Explore AgentPay <ArrowUpRight size={18} /></Link>
          <a href="https://github.com/ola-893/agentPay" target="_blank" rel="noreferrer" className="btn-outline">View source</a>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3 border-t border-white/10 pt-6">
          <div className="flex gap-3"><Workflow className="text-blue-400 shrink-0" /><div><p className="font-semibold text-white">CRE orchestration</p><p className="text-sm text-white/50 mt-1">Connect APIs and blockchain state.</p></div></div>
          <div className="flex gap-3"><ShieldCheck className="text-blue-400 shrink-0" /><div><p className="font-semibold text-white">Explicit payment policies</p><p className="text-sm text-white/50 mt-1">Bound spending and authorization.</p></div></div>
          <div className="flex gap-3"><Zap className="text-blue-400 shrink-0" /><div><p className="font-semibold text-white">Agent payment streams</p><p className="text-sm text-white/50 mt-1">Pay for ongoing service access.</p></div></div>
        </div>
      </div>
    </section>
  );
}
