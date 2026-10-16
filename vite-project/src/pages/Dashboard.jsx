import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import StreamSetup from '../components/StreamSetup';
import { ArrowRight } from 'lucide-react';
export default function Dashboard() {
  const {
    walletAddress,
    streamConfigured,
    outgoingStreams,
    incomingStreams,
    streamError,
  } = useWallet();
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Legacy streaming</p>
        <h1 className="page-title mt-3">Stream overview.</h1>
        <p className="mt-3 text-slate-400">
          Onchain stream records for your connected wallet.
        </p>
      </header>
      {!walletAddress || !streamConfigured ? (
        <StreamSetup />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Incoming streams', incomingStreams.length],
              ['Outgoing streams', outgoingStreams.length],
            ].map(([label, count]) => (
              <section key={label} className="panel p-6">
                <h2 className="text-sm text-slate-400">{label}</h2>
                <p className="mt-3 text-3xl font-semibold">{count}</p>
              </section>
            ))}
          </div>
          {streamError && (
            <p role="alert" className="text-sm text-amber-200">
              {streamError}
            </p>
          )}
          <Link to="/streams" className="btn-primary">
            Manage streams <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-slate-400">
            Based on the latest 49,000 blocks. API usage, gas savings, and agent
            telemetry are not connected.
          </p>
        </>
      )}
    </div>
  );
}
