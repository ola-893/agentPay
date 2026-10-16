// Keep token amounts as integers/strings: Number loses precision above 2^53.
export function formatTokenUnits(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid token decimals');
  if (!/^[0-9]+$/.test(String(value))) throw new Error('Invalid token units');
  const digits = BigInt(value).toString().padStart(decimals + 1, '0');
  if (decimals === 0) return digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? `.${fraction}` : '');
}
