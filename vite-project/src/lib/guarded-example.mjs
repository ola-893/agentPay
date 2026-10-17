import { formatTokenUnits } from "./token-units.mjs";

export function guardedExample(config, rawAmount) {
  return `// Save inside sdk/ (for example sdk/integration.ts).
import { GuardedPaymentClient } from './src';

// Supply an ethers signer from sdk/'s dependency, connected to Sepolia.
const client = new GuardedPaymentClient(signer, {
  guardAddress: '${config.guard}',
  settlementAddress: '${config.settlement}',
  chainId: 11155111,
});

// Inside your async agent function, AFTER the production guard accepts
// a fresh authenticated report for this requestId and payment intent:
await client.pay(
  requestId,
  '${config.recipient}',
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  ${rawAmount}n, // ${formatTokenUnits(rawAmount, 6)} USDC
);`;
}
