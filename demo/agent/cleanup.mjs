import cli from '../../scripts/lib/cli.cjs';
import {readStream, assertStreamIntent, closeStream} from './streams.mjs';

export async function cleanupFundedStream({provider, wallet, streamAddress,
  streamId, quote, guarded, authorizeClose, persist, audit}) {
  // Never fabricate failed health counters to force a healthy stream to CLOSE.
  assertStreamIntent(await readStream(provider, streamAddress, streamId), quote);
  if (guarded && !authorizeClose)
    throw new cli.CliError('POLICY_SIGNATURE_REQUIRED', 'Cleanup needs a signer-owned shutdown decision; use operator recovery if unavailable.');
  const policyApproval = guarded ? await authorizeClose() : undefined;
  return closeStream({provider, wallet, streamAddress, streamId, persist, audit, policyApproval});
}
