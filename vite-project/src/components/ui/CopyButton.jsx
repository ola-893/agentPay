import { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({
  value,
  label = 'Copy command',
  children,
  className = 'icon-button',
}) {
  const [feedback, setFeedback] = useState({ value: null, state: 'idle' });
  const state = feedback.value === value ? feedback.state : 'idle';
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ value, state: 'copied' });
    } catch {
      setFeedback({ value, state: 'failed' });
    }
    timer.current = setTimeout(
      () => setFeedback({ value, state: 'idle' }),
      4000
    );
  };
  return (
    <span className="relative inline-flex shrink-0 flex-col items-end">
      <button
        type="button"
        className={className}
        onClick={copy}
        aria-label={state === 'copied' ? 'Copied' : label}
        title={label}
      >
        {children}
        {state === 'copied' ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
      </button>
      <span
        role="status"
        className={
          state === 'failed'
            ? 'absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-white/20 bg-slate-900 p-2 text-xs text-slate-200'
            : 'sr-only'
        }
      >
        {state === 'copied'
          ? 'Copied to clipboard.'
          : state === 'failed'
          ? 'Clipboard unavailable. Select and copy the text instead.'
          : ''}
      </span>
    </span>
  );
}
