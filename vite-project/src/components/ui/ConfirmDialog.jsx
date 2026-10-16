import { useEffect, useId, useRef } from 'react';

export default function ConfirmDialog({
  open,
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  busy = false,
}) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-white/20 bg-slate-900 p-6 text-white shadow-2xl backdrop:bg-black/70"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-3 text-sm leading-relaxed text-slate-400">
        {children}
      </div>
      <p role="status" className="mt-3 text-xs text-slate-400">
        {busy
          ? 'Confirm or reject in your wallet. Hiding this dialog does not cancel a submitted transaction.'
          : ''}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          autoFocus
          type="button"
          className="btn-outline"
          onClick={onCancel}
        >
          {busy ? 'Hide dialog' : 'Go back'}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Check your wallet…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
