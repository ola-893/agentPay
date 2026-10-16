import { isAddress, ZeroAddress, parseEther } from 'ethers';

export function streamView(stream, now) {
  const elapsed = Math.max(
    0,
    Math.min(now, stream.stopTime) - stream.startTime
  );
  const duration = Math.max(1, stream.stopTime - stream.startTime);
  const earned =
    now >= stream.stopTime
      ? BigInt(stream.totalAmount)
      : BigInt(elapsed) * BigInt(stream.flowRate);
  const remaining =
    earned > BigInt(stream.amountWithdrawn)
      ? earned - BigInt(stream.amountWithdrawn)
      : 0n;
  return {
    status: !stream.isActive
      ? 'cancelled'
      : now >= stream.stopTime
      ? 'completed'
      : 'active',
    progress: Math.min(100, (elapsed / duration) * 100),
    claimable: stream.isActive ? remaining : 0n,
  };
}
export function validateStreamForm({ recipient, amount, duration, balance }) {
  const errors = {};
  if (!isAddress(recipient) || recipient === ZeroAddress)
    errors.recipient =
      'Enter a nonzero Ethereum address. ENS names are not supported here.';
  let raw;
  try {
    raw = parseEther(amount);
    if (raw <= 0n || raw >= 2n ** 256n) throw new Error();
  } catch {
    errors.amount = 'Enter a positive tUSD amount with up to 18 decimals.';
  }
  if (
    !/^[1-9][0-9]*$/.test(String(duration)) ||
    !Number.isSafeInteger(Number(duration))
  )
    errors.duration = 'Enter a positive duration in whole seconds.';
  if (raw && !errors.duration && raw / BigInt(duration) === 0n)
    errors.amount =
      'Increase the amount or shorten the duration so the per-second rate is not zero.';
  if (raw && balance != null) {
    try {
      if (raw > parseEther(balance))
        errors.amount = 'This exceeds your available tUSD balance.';
    } catch {
      /* RPC validation remains authoritative. */
    }
  }
  return errors;
}
