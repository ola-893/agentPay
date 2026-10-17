# Legacy tUSD payment streams

The streaming frontend and `AgentPaySDK` assume **18-decimal MockUSD/tUSD**, with no monetary value. Circle's six-decimal USDC is supported only by the separate guarded workflow/client. [Deploy and configure](../../DEPLOYMENT.md) before connecting a wallet.

## UI workflow

1. Set `VITE_CONTRACT_ADDRESS` and `VITE_PAYMENT_TOKEN_ADDRESS` in `vite-project/.env.local` to your new AgentPayStream/MockUSD deployment. Restart Vite.
2. Open Streams, connect a browser wallet on Ethereum Sepolia, and mint test tUSD if needed.
3. Enter a nonzero Ethereum recipient address (no ENS resolution), positive amount and whole-second duration. Default: 24 hours. Presets and custom duration use the same state.
4. Confirm approval if allowance is insufficient, then confirm stream creation. The app locks pending actions and shows wallet progress/errors.
5. Incoming/outgoing lists support search, status filters, sorting and pagination. Discovery covers the last 49000 blocks, not all history.

No balance is fabricated. Unavailable balances and failed stream queries show explicit errors rather than zero/empty success.

## Integer accounting

```text
flowRate = floor(totalAmount / duration)
```

The contract requires a nonzero rate. Before stop time, claimable equals elapsed whole seconds times flowRate minus amountWithdrawn. At or after stop time, claimable is **totalAmount - amountWithdrawn**, releasing rounding remainder. Cancellation sets inactive and pays recipient accrual plus sender refund.

Reaching stop time does not itself set `isActive` false. Ended active streams can still be withdrawn by the recipient. The gateway separately checks stop time and will not grant ongoing service based on an ended stream.

## Withdraw or close

Incoming cards show estimated claimable amounts; the contract determines final amounts. Only the recipient can withdraw. **Withdraw by stream ID** reads the onchain balance and verifies the connected recipient; changing IDs clears the previous result. Use this for older streams absent from discovery.

Either party can close/cancel an active stream. Accrued funds go to the recipient, remaining funds to the sender. Confirmation uses a wallet transaction. Disconnecting or changing account/network invalidates the local app session; reconnect to refresh. Closing the confirmation dialog does not cancel a transaction already sent to the wallet/network.

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
