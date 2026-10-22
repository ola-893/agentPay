import {
  Bot,
  Workflow,
  Wallet,
  Database,
  Globe,
  ArrowRight,
  ArrowDown,
  Repeat2,
  ShieldCheck,
} from "lucide-react";
export default function WorkflowDiagram({ decision }) {
  const nodes = [
    [
      Bot,
      "AI agent",
      "Requests a paid service",
      "Gets a bound HTTP 402 quote.",
    ],
    [
      Workflow,
      "Chainlink CRE",
      "Decides before the wallet acts",
      "Price + budget → OPEN / DENY. Health checkpoints → CONTINUE / CLOSE.",
    ],
    [
      Wallet,
      "Payer wallet",
      "Gates signing in the CLI",
      "Exact spend dry-run, risk rules, blob and confirmed audit receipt.",
    ],
    [
      Database,
      "Onchain escrow",
      "Accrues earnings with time",
      "Holds USDC; cancellation pays earnings and refunds unused funds.",
    ],
    [
      Globe,
      "Paid service",
      "Reuses one funded session",
      "Checks the signed session and stream state for each API request.",
    ],
  ];
  return (
    <section
      className="panel overflow-hidden p-5 sm:p-6"
      aria-labelledby="flow-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">How CRE supercharges a payment stream</p>
          <h2 id="flow-title" className="mt-2 text-xl font-semibold">
            One funded stream. Decisions throughout its life.
          </h2>
        </div>
        <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-200">
          CRE: local simulation
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/5 p-3 text-xs text-blue-100">
        <span>HTTP health + client counters</span>
        <span aria-hidden="true">+</span>
        <span>Coinbase + Chainlink USDC/USD</span>
        <span aria-hidden="true">+</span>
        <span>Sepolia balances + stream state</span>
        <ArrowDown size={15} aria-hidden="true" />
        <strong>CRE policy inputs</strong>
      </div>
      <ol
        className="mt-5 grid gap-4 lg:grid-cols-5"
        aria-label="Payment and decision flow"
      >
        {nodes.map(([Icon, title, subtitle, text], i) => (
          <li
            key={title}
            className={`relative min-w-0 rounded-xl border p-4 ${
              i === 1
                ? "border-blue-400/60 bg-blue-600/15 ring-1 ring-blue-400/20"
                : "border-white/10 bg-[#0b101c]/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <Icon
                size={24}
                className={i === 1 ? "text-blue-300" : "text-slate-400"}
                aria-hidden="true"
              />
              <span className="font-mono text-xs text-slate-500">0{i + 1}</span>
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-xs font-medium text-blue-200">{subtitle}</p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {text}
            </p>
            {i === 1 && decision && (
              <p className="mt-3 rounded-lg bg-blue-500/15 px-2 py-1 font-mono text-xs text-blue-100">
                Observed decision: {decision}
              </p>
            )}
            {i < 4 && (
              <ArrowRight
                size={17}
                className="absolute -right-4 top-1/2 z-10 hidden text-blue-300 lg:block"
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <p className="flex gap-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-4 text-xs leading-relaxed text-slate-300">
          <Repeat2
            size={21}
            className="shrink-0 text-emerald-300"
            aria-hidden="true"
          />
          <span>
            <strong className="block text-emerald-200">
              Request loop: agent ↔ paid service
            </strong>
            Many authenticated API calls reuse escrow. No token transaction per
            request; earnings accrue per second.
          </span>
        </p>
        <p className="flex gap-3 rounded-xl border border-blue-400/15 bg-blue-500/5 p-4 text-xs leading-relaxed text-slate-300">
          <ShieldCheck
            size={21}
            className="shrink-0 text-blue-300"
            aria-hidden="true"
          />
          <span>
            <strong className="block text-blue-200">
              Supervision loop: observations → CRE → wallet
            </strong>
            At CLI checkpoints, an observed outage produces CLOSE. The wallet
            cancels after spend review; the contract settles earned and unused
            funds.
          </span>
        </p>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        Streaming addresses the N+1 payment problem. CRE adds admission,
        service-health and spend decisions. Audit receipts add gas; this diagram
        does not promise fixed savings or continuous monitoring.
      </p>
    </section>
  );
}
