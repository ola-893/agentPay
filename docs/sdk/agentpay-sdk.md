# AgentPaySDK — legacy streaming client

[Source](../../sdk/src/AgentPaySDK.ts). This client is separate from CRE's [GuardedPaymentClient](guarded-payment-client.md) and assumes 18-decimal tUSD. It is not a complete current x402 client.

## Constructor

```ts
import { AgentPaySDK } from './sdk/src'; // root TypeScript entry point
import { parseEther } from 'ethers';
const sdk = new AgentPaySDK({
  privateKey, // server-side dedicated test wallet; never in frontend
  rpcUrl,
  agentId: 'legacy-agent', // optional
  apiKey, // optional provider API key
  spendingLimits: { // optional, bigint units
    dailyLimit: parseEther('100'),
    totalLimit: parseEther('1000'),
  },
});
```

`privateKey` and `rpcUrl` are required. No constructor `contractAddress`, `tokenAddress`, `maxRetries`, `defaultStreamDuration` or auto-approval option exists. The optional legacy Gemini helper reads `GEMINI_API_KEY` from the process; it is not needed for CRE simulation or the frontend.

## Public methods

| Method | Actual behavior |
| --- | --- |
| `makeRequest(url, axiosOptions?)` | Axios request, handles supported AgentPay HTTP 402 stream requirements and retries with a stream ID |
| `createStream(contractAddress, tokenAddress, amount, duration, metadata?, recipientAddress?)` | Approves as needed, creates a stream, returns `{ streamId, startTime }`; amount is bigint and recipient is required by validation |
| `selectPaymentMode(estimatedRequests)` | Calls optional legacy decision helper; returns `stream` or `direct` |
| `askAgent(query)` | Calls the legacy brain with cached metrics/context |
| `emergencyStop()` / `resume()` | Pauses/resumes this SDK instance's `makeRequest`; does not stop deployed workflows or all other instances |
| `getMetrics()` | Returns this instance's request/signing-negotiation counters; not measured gas savings or global telemetry |
| `calculateClaimable(metadata)` / `calculateRemaining(metadata)` | Local cached `StreamMetadata` arithmetic, not authoritative onchain withdrawal accounting |
| `getStreamDetails(streamId)` | Local placeholder metadata (`streamId`, agent ID and client name), not an RPC lookup |

For authoritative withdrawal/cancellation/query, use the deployed **AgentPayStream contract** methods with ethers or the frontend. There are no `sdk.request`, `sdk.getActiveStream`, `sdk.getStream`, `sdk.withdrawFromStream` or `sdk.cancelStream` methods.

## Explicit stream example

```ts
const { streamId } = await sdk.createStream(
  streamAddress,
  mockUsdAddress,
  parseEther('10'), // 10 tUSD, NOT USDC
  3600,
  { purpose: 'test API access' },
  providerRecipient,
);
```

The recipient must be nonzero, valid and distinct from the token address before signing. `makeRequest` can create a 3600-second stream from the provider's rate, checks its instance-local spend monitor and caches stream metadata by host. This is a heuristic cache, not a durable entitlement/metering system.

`SpendingMonitor` takes bigint `dailyLimit`/`totalLimit`. It maintains in-memory totals, resets daily after a 24-hour interval on a check, and detects more than five renewals per minute. It is not an onchain rolling budget, per-request cap or global emergency control. Explicit `createStream` calls do not pass through all `makeRequest` negotiation checks; callers must impose their own intent validation.

The included gateway rejects direct transaction-hash proof. Do not advertise its SDK's optional direct-enabled branch for that gateway. [Protocol and verification limitations](../architecture/x402-protocol.md).
