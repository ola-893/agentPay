# Legacy AgentPay HTTP 402 protocol

This guide documents the **actual project-specific headers** in [middleware](../../server/middleware/agentPayMiddleware.js) and [AgentPaySDK](../../sdk/src/AgentPaySDK.ts). It is not a claim of compatibility with the full current x402 transport, typed payment payloads, or facilitator protocol.

This path uses **18-decimal tUSD streams**, separately from the CRE-controlled USDC payment. A guarded settlement receipt is not automatically accepted by this gateway.

## Provider configuration

Example from a CommonJS entry point at the repository root:

```js
const express = require('express');
const agentPayMiddleware = require('./server/middleware/agentPayMiddleware');
const app = express();
app.use(agentPayMiddleware({
  rpcUrl: process.env.SEPOLIA_RPC_URL,
  agentPayContractAddress: process.env.AGENTPAY_STREAM_ADDRESS,
  tokenAddress: process.env.PAYMENT_TOKEN_ADDRESS,
  recipientAddress: process.env.PAYMENT_RECIPIENT_ADDRESS,
  routes: {
    '/api/premium': { mode: 'streaming', price: '0.0001' },
  },
}));
app.get('/api/premium', (req, res) => {
  res.json({ streamId: req.agentPay.streamId, content: 'Example response' });
});
app.listen(3005);
```

Use real legacy deployments and the configured provider recipient. `price` is a **minimum flow rate in tUSD/second**, parsed with `parseEther`; it is not a USDC amount or metered per-request charge. Configure routes at the same mount path as `req.path`; matching is exact first, then a simple prefix match. Unconfigured routes pass through without payment checks. An optional `apiKey` requires matching `x-api-key` before payment verification.

## Response headers

When no stream ID is supplied, middleware responds HTTP 402:

| Header | Value/source |
| --- | --- |
| `X-Payment-Required` | `true` |
| `X-AgentPay-Mode` | Route mode, normally `streaming` |
| `X-AgentPay-Rate` | Human decimal tUSD rate, such as `0.0001` |
| `X-Payment-Token` | Legacy token contract address |
| `X-AgentPay-Recipient` | Provider payment recipient |
| `X-AgentPay-Contract` | AgentPayStream contract address |

The JSON body includes `message: "Payment Required"` and `requirements` with mode, price, currency `tUSD`, contract and recipient. Older guides showing `X-Payment-Types`, `X-Payment-Currency`, `X-AgentPay-Signature` or timestamp proof do not describe this implementation.

## Request and checks

The consumer retries with `X-AgentPay-Stream-ID`. Middleware checks:

1. `isStreamActive(streamId)`;
2. recipient equals configured provider recipient;
3. stream has started and has not reached stop time;
4. `flowRate` is at least the route rate.

It attaches `req.agentPay = { streamId }` on success. Verification failures return 402. **`X-AgentPay-Tx-Hash` is deliberately rejected.** No signature, receipt ownership, request nonce, replay consumption, durable usage accounting or payer/session authentication is implemented by the current middleware.

## Legacy SDK

`AgentPaySDK.makeRequest` reads the supported headers. For a streaming negotiation it creates an hour-long stream at the requested rate, attaches a stream ID and caches it in memory by host. These are prototype heuristics, not a robust multi-route entitlement system. The provided server's `per-request` demo mode is not supported by the SDK's streaming/hybrid negotiation; use a configured streaming provider for the compatible demo.

The SDK contains a direct-transfer branch that can spend when a server explicitly advertises its direct-enabled header. The included gateway disables hash acceptance; do not enable or advertise that branch for it. Use [GuardedPaymentClient](../sdk/guarded-payment-client.md) for explicit CRE settlement, then design separate authenticated API access if required.
