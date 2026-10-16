import { useEffect, useRef } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Header from './Header';
import { MobileBottomNav, ErrorBoundary } from './ui';

export default function Layout() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    const heading = document.querySelector('main h1')?.textContent;
    document.title = heading
      ? `${heading} · AgentPay`
      : 'AgentPay — Chainlink CRE payments';
    if (previous.current !== pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('main-content')?.focus({ preventScroll: true });
      previous.current = pathname;
    }
  }, [pathname]);
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-7xl px-4 pt-7 pb-8 outline-none sm:px-6 sm:pt-10 lg:px-8"
      >
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="app-footer mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pt-8 text-xs text-slate-400 sm:px-6 lg:px-8">
        <p>
          AgentPay · Ethereum Sepolia · Testnet tokens have no monetary value.
        </p>
        <Link
          to="/docs/cre"
          className="min-h-11 inline-flex items-center text-slate-300 hover:text-white"
        >
          Workflow & trust boundaries ↗
        </Link>
      </footer>
      <MobileBottomNav />
    </div>
  );
}
