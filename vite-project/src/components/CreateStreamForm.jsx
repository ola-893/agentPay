import { useId, useState } from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { parseEther, formatEther } from 'ethers';
import { validateStreamForm } from '../lib/stream-state.mjs';

const presets = [
  ['1 hour', '3600'],
  ['24 hours', '86400'],
  ['7 days', '604800'],
];
export default function CreateStreamForm({
  recipient,
  setRecipient,
  amountEth,
  setAmountEth,
  durationSeconds,
  setDurationSeconds,
  balance,
  isProcessing,
  onSubmit,
}) {
  const id = useId();
  const [submitted, setSubmitted] = useState(false);
  const errors = validateStreamForm({
    recipient,
    amount: amountEth,
    duration: durationSeconds,
    balance,
  });
  let rate = null;
  try {
    if (!errors.amount && !errors.duration)
      rate = formatEther(parseEther(amountEth) / BigInt(durationSeconds));
  } catch {
    /* Incomplete input. */
  }
  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length || isProcessing) return;
    if (await onSubmit()) setSubmitted(false);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <label htmlFor={`${id}-recipient`} className="field-label">
          Recipient address
        </label>
        <input
          id={`${id}-recipient`}
          className="input-default font-mono text-sm"
          placeholder="0x…"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          disabled={isProcessing}
          aria-invalid={submitted && Boolean(errors.recipient)}
          aria-describedby={`${id}-recipient-help`}
        />
        <p
          id={`${id}-recipient-help`}
          className={`mt-2 text-xs leading-relaxed ${
            submitted && errors.recipient ? 'text-amber-200' : 'text-slate-400'
          }`}
        >
          {submitted && errors.recipient
            ? errors.recipient
            : 'Ethereum address only. Check the recipient before signing.'}
        </p>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label
            htmlFor={`${id}-amount`}
            className="text-sm font-medium text-slate-200"
          >
            Amount (tUSD)
          </label>
          <button
            type="button"
            className="min-h-9 px-2 text-xs font-medium text-blue-300"
            onClick={() => setAmountEth(balance)}
            disabled={balance == null || isProcessing}
          >
            Use balance
          </button>
        </div>
        <input
          id={`${id}-amount`}
          className="input-default"
          inputMode="decimal"
          placeholder="10.00"
          value={amountEth}
          onChange={(e) => setAmountEth(e.target.value)}
          disabled={isProcessing}
          aria-invalid={submitted && Boolean(errors.amount)}
          aria-describedby={`${id}-amount-help`}
        />
        <p
          id={`${id}-amount-help`}
          className={`mt-2 break-words text-xs ${
            submitted && errors.amount ? 'text-amber-200' : 'text-slate-400'
          }`}
        >
          {submitted && errors.amount
            ? errors.amount
            : balance == null
            ? 'Balance unavailable. Refresh your wallet balance.'
            : `Available: ${balance} tUSD`}
        </p>
      </div>
      <fieldset disabled={isProcessing}>
        <legend className="field-label">Duration</legend>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {presets.map(([label, value]) => (
            <button
              key={value}
              type="button"
              aria-pressed={durationSeconds === value}
              onClick={() => setDurationSeconds(value)}
              className={`min-h-11 rounded-lg border text-sm ${
                durationSeconds === value
                  ? 'border-blue-400/50 bg-blue-500/10 text-blue-200'
                  : 'border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label
          htmlFor={`${id}-duration`}
          className="mb-2 block text-xs text-slate-400"
        >
          Or enter a custom duration in seconds
        </label>
        <input
          id={`${id}-duration`}
          className="input-default"
          inputMode="numeric"
          value={durationSeconds}
          onChange={(e) => setDurationSeconds(e.target.value)}
          aria-invalid={submitted && Boolean(errors.duration)}
          aria-describedby={`${id}-duration-help`}
        />
        <p id={`${id}-duration-help`} className="mt-2 text-xs text-amber-200">
          {submitted && errors.duration ? errors.duration : ''}
        </p>
      </fieldset>
      {rate && (
        <div className="rounded-xl border border-white/10 bg-[#0b101c] p-4">
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <Clock size={16} />
            Estimated flow rate
          </p>
          <p className="mt-2 break-all font-mono text-sm text-blue-200">
            {rate} tUSD / second
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Total {amountEth} tUSD over {durationSeconds} seconds. Sepolia ETH
            is required for gas.
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={isProcessing}
        aria-busy={isProcessing}
        className="btn-primary w-full"
      >
        {isProcessing ? 'Check your wallet…' : 'Create stream'}
        {!isProcessing && <ArrowRight size={16} />}
      </button>
      <p className="text-xs leading-relaxed text-slate-400">
        Your wallet may request two confirmations: token approval, then stream
        creation.
      </p>
    </form>
  );
}
