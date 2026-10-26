# Legacy tUSD payment streams

The legacy `AgentPaySDK` assumes **18-decimal MockUSD/tUSD**, with no monetary value. The current AI CLI uses AgentPayGuardedStream for six-decimal Circle USDC, with local CRE checks and contract-verified policy signatures; see the [AI streaming guide](../AI_AGENT_DEMO.md). [Deploy and configure](../../DEPLOYMENT.md) before signing. The frontend contains Workflow and Docs, rather than a stream-management page.

## Legacy SDK workflow

Configure the dedicated wallet, Sepolia RPC and legacy deployment using the [SDK guide](../sdk/agentpay-sdk.md). Supply a distinct recipient, a positive 18-decimal tUSD amount and a whole-second duration. `createStream` approves tokens as needed and funds escrow. Use contract reads for stream state and accrued balances. The current Workflow page visualizes the separate USDC CLI; it does not create or manage legacy streams.

The legacy SDK's model-assisted mode selection is separate from the deterministic CRE payment policy in the USDC CLI. Do not present the legacy model as the source of CRE results.

## Integer accounting

```text
flowRate = floor(totalAmount / duration)
```

The contract requires a nonzero rate. Before stop time, claimable equals elapsed whole seconds times flowRate minus amountWithdrawn. At or after stop time, claimable is **totalAmount - amountWithdrawn**, releasing rounding remainder. Cancellation sets inactive and pays recipient accrual plus sender refund.

Reaching stop time does not itself set `isActive` false. Ended active streams can still be withdrawn by the recipient. The gateway separately checks stop time and will not grant ongoing service based on an ended stream.

## Withdraw or close

Use `getClaimableBalance(streamId)` to read accrued funds from the contract. Only the recipient can call `withdrawFromStream(streamId)`; the contract determines the final amount.

Either party can call `cancelStream(streamId)` on an active stream. Accrued funds go to the recipient, remaining funds to the sender. Withdrawal and cancellation are wallet-signed transactions; inspect their receipts before retrying after uncertain confirmation.

## Contract and SDK calls

Use [AgentPayStream reference](../contracts/agentpaystream.md) for direct contract methods. The legacy SDK has a positional `createStream` method, not an object-based constructor API:

```ts
// TypeScript entry point inside sdk/; supply actual config/addresses.
import { AgentPaySDK } from './src';
import { parseEther } from 'ethers';
const sdk = new AgentPaySDK({ privateKey, rpcUrl, agentId: 'legacy-stream-agent' });
const { streamId } = await sdk.createStream(
  streamAddress, mockUsdAddress, parseEther('10'), 3600,
  { purpose: 'test API access' }, providerRecipient,
);
```

This can approve/spend test tokens. The recipient is a required distinct address. `withdrawFromStream`, `cancelStream` and `getStream` are contract methods, not public methods on `AgentPaySDK`. [Actual SDK API](../sdk/agentpay-sdk.md).
