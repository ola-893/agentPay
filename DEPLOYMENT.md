# AgentPay setup and deployment

## Simulation and frontend

Recorded evidence and read-only CRE simulation require no deployed AgentPay contracts. Follow [README](README.md). The RPC is in `cre/project.yaml`; use a reliable Sepolia HTTPS endpoint if the public RPC is busy.

`npm run build:web` produces `vite-project/dist`, a static React app with evidence JSON from `public/evidence`. Preserve the SPA fallback (`_redirects` / `netlify.toml`) when hosting. No hosting deployment is included in the recorded evidence.

## Optional public-network deployment (not performed here)

1. Copy `.env.example` to `.env` and set a testnet `PRIVATE_KEY` and RPC.
2. Set `CRE_FORWARDER_ADDRESS` from the official Chainlink CRE forwarder directory for Sepolia. Use the production forwarder, not a wallet or a mock.
3. Run `npm run deploy:guard`. It deploys and connects AgentPayGuard and AgentPaySettlement. With a blank `CRE_WORKFLOW_ID`, reporting remains disabled.
4. In `cre/payment-guard/config.staging.json`, configure real agent, recipient, token, integer amounts and cap, a fresh random 32-byte request ID, the guard receiver address, and `publishReport: true`.
5. Obtain CRE deployment access and follow the [official deployment guide](https://docs.chain.link/cre/guides/operations/deploying-workflows). Deploy the configured workflow, then call `guard.setWorkflowId(actualWorkflowId)` from its deploying owner. Updates that change workflow identity need a corresponding binding update. Reports fail until identity matches.
6. Once a report has been accepted onchain, use the guarded client with a funded signer and the deployed addresses.

```ts
import { GuardedPaymentClient } from './sdk/src';
const payments = new GuardedPaymentClient(signer, {
  guardAddress, settlementAddress, chainId: 11155111,
});
const receipt = await payments.pay(requestId, recipient, token, amountInTokenUnits);
```

The consumer accepts 62-byte packed identity metadata and the 64-byte production forwarder form. It verifies forwarder, workflow ID, destination chain and receiver, request uniqueness, payment parties, and expiry. Settlement consumes authorization before transfer; transfer failure reverts the complete operation. An ABI report body or frontend JSON cannot call the consumer directly.

The forwarder is immutable. The owner can configure workflow identity and connect a deployed settlement contract once. Protect that owner key and review workflow configuration. This is an unaudited prototype, not a production payments service.

## Legacy stream deployment

`npm run deploy:sepolia` deploys new AgentPayStream and MockUSD contracts. Do not reuse old addresses: the new ABI uses `paymentToken()`.

Server/demo: set `AGENTPAY_STREAM_ADDRESS`, `PAYMENT_TOKEN_ADDRESS`, and `PAYMENT_RECIPIENT_ADDRESS` in `.env`. Frontend: set `VITE_CONTRACT_ADDRESS` and `VITE_PAYMENT_TOKEN_ADDRESS` in `vite-project/.env.local`.

The original stream UI and SDK assume 18-decimal test tokens; do not point them at 6-decimal USDC. The new guarded client accepts integer token units, with the matching units required in workflow policy.

The stream gateway checks active status, recipient, start/stop time, and minimum rate. Direct receipt-hash acceptance is disabled. Production service access additionally needs an authenticated payer/session design and durable usage accounting. Guarded settlement is a separate explicit payment path.
