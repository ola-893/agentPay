import { useId, useState } from 'react';
import { formatEther } from 'ethers';
import { ArrowUpRight, Wallet } from 'lucide-react';
import { streamView } from '../lib/stream-state.mjs';
import ConfirmDialog from './ui/ConfirmDialog';

export default function StreamCard({
  stream,
  variant,
  onWithdraw,
  onCancel,
  isProcessing,
  now,
}) {
  const [action, setAction] = useState(null);
  const view = streamView(stream, now);
  const descriptionId = useId();
  const other = variant === 'incoming' ? stream.sender : stream.recipient;
  const canWithdraw = variant === 'incoming' && view.claimable > 0n;
  const label =
    view.status === 'active'
      ? 'Streaming'
      : view.status === 'cancelled'
      ? 'Closed'
      : view.claimable > 0n
      ? 'Ended · funds available'
      : 'Completed';
  const confirm = async () => {
    await (action === 'withdraw'
      ? onWithdraw?.(stream.id)
      : onCancel?.(stream.id));
    setAction(null);
  };
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Stream #{stream.id}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs ${
            view.status === 'active'
              ? 'bg-blue-500/10 text-blue-200'
              : 'bg-white/5 text-slate-300'
          }`}
        >
          {label}
        </span>
      </div>
      <p className="mt-3 break-all text-xs text-slate-400">
        {variant === 'incoming' ? 'From' : 'To'}{' '}
        <a
          className="font-mono text-blue-300"
          href={`https://sepolia.etherscan.io/address/${other}`}
          target="_blank"
          rel="noreferrer"
          title={other}
        >
          {other.slice(0, 8)}…{other.slice(-6)}{' '}
          <ArrowUpRight size={12} className="inline" />
        </a>
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-400">Total allocated</p>
          <p className="mt-1 break-all text-lg font-semibold">
            {formatEther(stream.totalAmount)} tUSD
          </p>
        </div>
        {variant === 'incoming' && (
          <div>
            <p className="text-xs text-slate-400">Estimated claimable</p>
            <p className="mt-1 break-all text-lg font-semibold text-emerald-300">
              {formatEther(view.claimable)} tUSD
            </p>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>Time elapsed</span>
        <span>{Math.floor(view.progress)}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label={`Stream ${stream.id} elapsed duration`}
        aria-valuenow={Math.floor(view.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${view.progress}%` }}
        />
      </div>
      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-slate-300">
          Stream details
        </summary>
        <dl
          id={descriptionId}
          className="mt-2 grid gap-3 text-xs text-slate-400"
        >
          <div>
            <dt>Flow rate</dt>
            <dd className="mt-1 break-all font-mono text-slate-200">
              {formatEther(stream.flowRate)} tUSD / second
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd className="mt-1 text-slate-200">
              {new Date(stream.startTime * 1000).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd className="mt-1 text-slate-200">
              {new Date(stream.stopTime * 1000).toLocaleString()}
            </dd>
          </div>
        </dl>
      </details>
      {(canWithdraw ||
        (stream.isActive && view.claimable > 0n) ||
        view.status === 'active') && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {canWithdraw && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setAction('withdraw')}
              disabled={isProcessing}
            >
              <Wallet size={16} />
              Withdraw
            </button>
          )}
          {stream.isActive && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => setAction('cancel')}
              disabled={isProcessing}
            >
              Close stream
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={action !== null}
        title={
          action === 'withdraw'
            ? `Withdraw from stream #${stream.id}?`
            : `Close stream #${stream.id}?`
        }
        onCancel={() => setAction(null)}
        onConfirm={confirm}
        busy={isProcessing}
        confirmLabel={
          action === 'withdraw' ? 'Confirm withdrawal' : 'Confirm closure'
        }
      >
        {action === 'withdraw'
          ? 'Your wallet will ask you to confirm withdrawal of the onchain claimable amount. The estimate above may change before confirmation.'
          : 'This ends the stream. Accrued funds go to the recipient and the unspent balance returns to the sender. Your wallet will ask for confirmation.'}
      </ConfirmDialog>
    </article>
  );
}
