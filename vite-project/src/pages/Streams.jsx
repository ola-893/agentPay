import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  ArrowRightLeft,
  Plus,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { paymentTokenAddress } from '../contactInfo';
import StreamSetup from '../components/StreamSetup';
import CreateStreamForm from '../components/CreateStreamForm';
import StreamList from '../components/StreamList';
import { CollapsibleSection } from '../components/ui/MobileNav';

export default function Streams() {
  const {
    walletAddress,
    streamConfigured,
    tokenBalance,
    balanceError,
    streamError,
    isProcessing,
    isLoadingStreams,
    incomingStreams,
    outgoingStreams,
    fetchTokenBalance,
    mintPaymentTokens,
    refreshStreams,
    createStream,
    withdraw,
    cancel,
    getClaimableBalance,
    status,
  } = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('86400');
  const [streamId, setStreamId] = useState('');
  const [checked, setChecked] = useState(null);
  const [checking, setChecking] = useState(false);
  const checkVersion = useRef(0);
  const ready = streamConfigured && walletAddress;
  const submit = async () => {
    const result = await createStream(recipient, duration, amount);
    if (!result?.confirmed) return false;
    setRecipient('');
    setAmount('');
    return true;
  };
  const check = async () => {
    const version = ++checkVersion.current;
    setChecking(true);
    setChecked(null);
    try {
      const value = await getClaimableBalance(streamId);
      if (version === checkVersion.current) setChecked({ id: streamId, value });
    } catch (error) {
      if (version === checkVersion.current)
        setChecked({
          id: streamId,
          error: error.shortMessage || error.message,
        });
    } finally {
      if (version === checkVersion.current) setChecking(false);
    }
  };
  const withdrawChecked = async () => {
    if (await withdraw(streamId)) await check();
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <ArrowRightLeft size={15} />
            Legacy streaming
          </p>
          <h1 className="page-title mt-3">Payment streams.</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
            Create and manage the separate per-second tUSD streams on Sepolia.
            Learn how the CLI uses CRE to supervise USDC streams in the{' '}
            <Link to="/" className="text-blue-300 underline underline-offset-4">
              CRE workflow
            </Link>
            .
          </p>
        </div>
        {ready && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => Promise.all([refreshStreams(), fetchTokenBalance()])}
            disabled={isLoadingStreams || isProcessing}
          >
            <RefreshCw
              size={16}
              className={isLoadingStreams ? 'animate-spin' : ''}
            />
            {isLoadingStreams ? 'Refreshing…' : 'Refresh streams'}
          </button>
        )}
      </header>
      {!ready ? (
        <StreamSetup />
      ) : (
        <>
          <section className="panel flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-sm text-slate-400">
                Your legacy test token balance
              </p>
              <p className="mt-2 break-all text-2xl font-semibold">
                {tokenBalance == null ? 'Unavailable' : `${tokenBalance} tUSD`}
              </p>
              <a
                className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs text-blue-300"
                href={`https://sepolia.etherscan.io/token/${paymentTokenAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                Token contract <ArrowUpRight size={14} />
              </a>
              {balanceError && (
                <p
                  role="alert"
                  className="mt-2 max-w-lg text-sm text-amber-200"
                >
                  {balanceError}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={() => mintPaymentTokens('1000')}
              disabled={isProcessing}
            >
              Mint 1000 test tUSD
            </button>
          </section>
          <p role="status" className="text-sm text-slate-300">
            {isProcessing
              ? status
              : 'Transactions require wallet confirmation. tUSD has no monetary value.'}
          </p>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <CollapsibleSection title="Create stream" icon={<Plus size={18} />}>
              <CreateStreamForm
                recipient={recipient}
                setRecipient={setRecipient}
                amountEth={amount}
                setAmountEth={setAmount}
                durationSeconds={duration}
                setDurationSeconds={setDuration}
                balance={tokenBalance}
                isProcessing={isProcessing}
                onSubmit={submit}
              />
            </CollapsibleSection>
            <CollapsibleSection
              title="Withdraw by stream ID"
              icon={<Wallet size={18} />}
            >
              <p className="mb-5 text-sm leading-relaxed text-slate-400">
                Check the onchain amount before withdrawing. Only the recipient
                can withdraw a stream.
              </p>
              <label htmlFor="withdraw-stream-id" className="field-label">
                Stream ID
              </label>
              <input
                id="withdraw-stream-id"
                className="input-default"
                inputMode="numeric"
                placeholder="e.g. 1"
                value={streamId}
                disabled={isProcessing || checking}
                onChange={(e) => {
                  setStreamId(e.target.value);
                  checkVersion.current++;
                  setChecked(null);
                }}
              />
              <button
                type="button"
                onClick={check}
                className="btn-outline mt-4 w-full"
                disabled={
                  !/^[1-9][0-9]*$/.test(streamId) || checking || isProcessing
                }
              >
                {checking
                  ? 'Checking onchain balance…'
                  : 'Check claimable balance'}
              </button>
              {checked?.error && (
                <p
                  role="alert"
                  className="mt-4 break-words text-sm text-amber-200"
                >
                  {checked.error}
                </p>
              )}
              {checked?.value != null && (
                <div className="mt-5 rounded-xl border border-white/10 p-4">
                  <p className="text-xs text-slate-400">
                    Claimable from stream #{checked.id}
                  </p>
                  <p className="mt-2 break-all text-xl font-semibold">
                    {checked.value} tUSD
                  </p>
                  <button
                    type="button"
                    className="btn-primary mt-4 w-full"
                    onClick={withdrawChecked}
                    disabled={
                      isProcessing ||
                      checked.id !== streamId ||
                      Number(checked.value) <= 0
                    }
                  >
                    {isProcessing
                      ? 'Check your wallet…'
                      : 'Withdraw claimable tUSD'}
                  </button>
                </div>
              )}
            </CollapsibleSection>
          </div>
          {streamError && (
            <div role="alert" className="panel p-5">
              <h2 className="font-semibold text-amber-200">
                Streams could not be refreshed
              </h2>
              <p className="mt-2 break-words text-sm text-slate-400">
                {streamError}
              </p>
              <button
                type="button"
                onClick={refreshStreams}
                disabled={isLoadingStreams}
                className="btn-outline mt-4"
              >
                Retry loading streams
              </button>
            </div>
          )}
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <StreamList
              title="Incoming streams"
              streams={incomingStreams}
              variant="incoming"
              isLoading={isLoadingStreams}
              onWithdraw={withdraw}
              onCancel={cancel}
              isProcessing={isProcessing}
            />
            <StreamList
              title="Outgoing streams"
              streams={outgoingStreams}
              variant="outgoing"
              isLoading={isLoadingStreams}
              onCancel={cancel}
              isProcessing={isProcessing}
            />
          </div>
          <p className="text-xs text-slate-400">
            Stream discovery covers the most recent 49,000 blocks. Use a known
            stream ID above to withdraw from an older stream.
          </p>
        </>
      )}
    </div>
  );
}
