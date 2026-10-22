import { Link, useLocation } from 'react-router-dom';
import { navigation, isCurrentPage } from '../lib/navigation';

export default function Header() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b101c]/95 backdrop-blur-xl safe-area-top">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="AgentPay home"
          className="flex shrink-0 items-center gap-2.5 rounded-lg"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white"
          >
            A
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight">
              AgentPay
            </span>
            <span className="hidden text-[11px] text-slate-400 sm:block">
              Streams supervised with Chainlink CRE
            </span>
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 lg:flex"
        >
          {navigation.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              aria-current={isCurrentPage(path, pathname) ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                isCurrentPage(path, pathname)
                  ? 'bg-blue-500/15 text-blue-200'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Sepolia testnet
          </span>
        </div>
      </div>
    </header>
  );
}
