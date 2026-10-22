import { Link } from 'react-router-dom';
import { ArrowRightLeft, ArrowRight, Settings2, Wallet } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

export default function StreamSetup() {
  const {
    streamConfigured,
    walletAddress,
    connectWallet,
    isConnecting,
    connectionError,
  } = useWallet();
  if (streamConfigured && walletAddress) return null;
  return (
    <section className="panel mx-auto max-w-3xl p-6 sm:p-8">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
        <ArrowRightLeft size={25} />
      </span>
      <h2 className="mt-5 text-xl font-semibold">
        {streamConfigured
          ? 'Connect to your streams'
          : 'Set up legacy streaming'}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        This page manages 18-decimal tUSD streams. The AI CLI uses six-decimal
        Circle USDC, with CRE checks before funding and at service-health
        checkpoints. Explore that workflow and its recorded evidence without a
        browser wallet.
      </p>
      <ol className="mt-6 space-y-4 text-sm">
        <li className="flex gap-3">
          <Settings2 size={19} className="mt-0.5 shrink-0 text-blue-300" />
          <div>
            <p className="font-medium">Configure stream contracts</p>
            <p className="mt-1 text-slate-400">
              {streamConfigured
                ? 'Stream and token addresses are configured.'
                : 'Deploy the stream and MockUSD contracts, then set the two frontend addresses in .env.local.'}
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <Wallet size={19} className="mt-0.5 shrink-0 text-blue-300" />
          <div>
            <p className="font-medium">Connect on Ethereum Sepolia</p>
            <p className="mt-1 text-slate-400">
              {walletAddress
                ? 'Wallet connected. Finish configuring the stream contracts above.'
                : 'Connect a browser wallet to view balances and manage your streams.'}
            </p>
          </div>
        </li>
      </ol>
      {connectionError && (
        <p role="alert" className="mt-5 text-sm leading-relaxed text-amber-200">
          {connectionError}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {streamConfigured && !walletAddress ? (
          <button
            type="button"
            onClick={connectWallet}
            disabled={isConnecting}
            className="btn-primary"
          >
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        ) : (
          <Link to="/docs/setup" className="btn-primary">
            Setup instructions <ArrowRight size={16} />
          </Link>
        )}
        <Link to="/" className="btn-outline">
          Explore USDC workflow
        </Link>
      </div>
    </section>
  );
}
