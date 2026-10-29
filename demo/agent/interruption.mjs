import cli from '../../scripts/lib/cli.cjs';

// Stop at a safe boundary; do not abandon submitted transaction confirmation.
export function watchInterruption(target = process, onRequest = () => {}) {
  let requested;
  const request = signal => {
    if (requested) return;
    requested = signal;
    onRequest(signal);
  };
  const onInt = () => request('SIGINT');
  const onTerm = () => request('SIGTERM');
  target.on('SIGINT', onInt);
  target.on('SIGTERM', onTerm);
  return {
    assertRunning() {
      if (requested) throw new cli.CliError('INTERRUPTED',
        `${requested} requested; stopping at a safe boundary and checking funded-stream cleanup.`,
        requested === 'SIGINT' ? 130 : 143);
    },
    dispose() {
      target.removeListener('SIGINT', onInt);
      target.removeListener('SIGTERM', onTerm);
    },
  };
}
