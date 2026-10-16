import { useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import Header from './Header';
import Hero from './Hero';
import { MobileBottomNav, ErrorBoundary } from './ui';
import { LayoutDashboard, ArrowRightLeft, Bot, BookOpen } from 'lucide-react';

const tabs = [
  { id: 'dashboard', path: '/', icon: LayoutDashboard, label: 'CRE Workflow' },
  { id: 'streams', path: '/streams', icon: ArrowRightLeft, label: 'Streams' },
  { id: 'agent', path: '/agent', icon: Bot, label: 'Agent Console' },
  { id: 'docs', path: '/docs', icon: BookOpen, label: 'Docs' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { walletAddress, chainId, getNetworkName, connectWallet, tokenBalance } = useWallet();

  const isDashboard = location.pathname === '/';

  return (
    <div className="min-h-screen w-full">
      <div className="absolute inset-0 bg-grid bg-[size:24px_24px] opacity-20 pointer-events-none" />

      <Header
        walletAddress={walletAddress}
        chainId={chainId}
        networkName={getNetworkName(chainId)}
        onConnect={connectWallet}
        balance={tokenBalance}
        tabs={tabs}
      />

      {isDashboard && <Hero networkName={getNetworkName(chainId)} />}

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 md:pb-16">
        <div className="mt-6 md:mt-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        walletAddress={walletAddress}
        tabs={tabs}
      />


    </div>
  );
}
