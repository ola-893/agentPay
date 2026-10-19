# AgentPay setup and deployment

## Simulation and frontend

Recorded evidence and read-only CRE simulation require no deployed AgentPay contracts. Follow [README](README.md). The RPC is in `cre/project.yaml`; use a reliable Sepolia HTTPS endpoint if the public RPC is busy.

`npm run build:web` produces `vite-project/dist`, a static React app with evidence JSON from `public/evidence`. Preserve the SPA fallback (`_redirects` / `netlify.toml`) when hosting. No hosting deployment is included in the recorded evidence.

## Separate simulation-only write demo

See [recording readiness](docs/RECORDING_READINESS.md) for the optional `AgentPaySimulationReceiver`, its dedicated Sepolia test wallet, explicit identity-skip opt-in, and receipt-verified broadcast runner. It records a mock-forwarder demo but cannot authorize or settle payments. No demo deployment or broadcast was performed during this repository update.

## Optional production consumer deployment (not performed here)

1. Copy `.env.example` to `.env` and set a testnet `PRIVATE_KEY` and RPC.
2. Set `CRE_FORWARDER_ADDRESS` from the official Chainlink CRE forwarder directory for Sepolia. Use the production forwarder, not a wallet or a mock.
3. Run `npm run deploy:guard`. It deploys and connects AgentPayGuard and AgentPaySettlement. With a blank `CRE_WORKFLOW_ID`, reporting remains disabled.
4. In `cre/payment-guard/config.staging.json`, configure real agent and recipient, six-decimal USDC integer amounts and cap, a fresh random 32-byte request ID, the guard receiver address, and `publishReport: true`.
5. Obtain CRE deployment access and follow the [official deployment guide](https://docs.chain.link/cre/guides/operations/deploying-workflows). Deploy the configured workflow, then call `guard.setWorkflowId(actualWorkflowId)` from its deploying owner. Updates that change workflow identity need a corresponding binding update. Reports fail until identity matches.
6. Once a report has been accepted onchain, use the guarded client with a funded signer and the deployed addresses.

Save integration fragments inside `sdk/` (for example `sdk/integration.ts`), importing `./src` and `ethers` there. Supply the deployment variables and run awaited calls inside an async function. Root and SDK ethers copies currently have incompatible signer types; see the [checked integration example](docs/sdk/guarded-payment-client.md).

```ts
import { GuardedPaymentClient } from './src';
const payments = new GuardedPaymentClient(signer, {
  guardAddress, settlementAddress, chainId: 11155111,
});
// Circle USDC on Ethereum Sepolia; 0.01 USDC = 10000 atomic units.
const token = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const receipt = await payments.pay(requestId, recipient, token, 10000n);
```

The consumer accepts 62-byte packed identity metadata and the 64-byte production forwarder form. It verifies forwarder, workflow ID, destination chain and receiver, request uniqueness, payment parties, and expiry. Settlement consumes authorization before transfer; transfer failure reverts the complete operation. An ABI report body or frontend JSON cannot call the consumer directly. The reported amount is an upper bound: one positive payment up to it can consume the request, after which unused headroom is not reusable.

The forwarder is immutable. The owner can configure workflow identity and connect a deployed settlement contract once. Protect that owner key and review workflow configuration. This is an unaudited prototype, not a production payments service.

## Legacy stream deployment

The [confirmed Sepolia stream deployment](docs/deployment/sepolia.md#confirmed-project-deployment) provides current public addresses and receipt/bytecode evidence. Only local ignored environment files are automatically configured; new checkouts must supply their own settings.

`npm run deploy:sepolia` deploys new AgentPayStream and MockUSD contracts. Do not reuse old addresses: the new ABI uses `paymentToken()`.

Server/demo: set `AGENTPAY_STREAM_ADDRESS`, `PAYMENT_TOKEN_ADDRESS`, and `PAYMENT_RECIPIENT_ADDRESS` in `.env`. Frontend: set `VITE_CONTRACT_ADDRESS` and `VITE_PAYMENT_TOKEN_ADDRESS` in `vite-project/.env.local`, then restart Vite. Without both nonzero addresses, Streams shows setup guidance. [Frontend usage](vite-project/README.md).

The guarded workflow pins Circle Sepolia USDC, its six decimals and the matching USDC/USD feed/API. Do not change only the token address to support another asset. [USDC policy setup and faucet](docs/USDC_SEPOLIA.md).

The original stream UI and SDK assume 18-decimal test tokens; do not point them at 6-decimal USDC. The new guarded client accepts integer token units, with the matching units required in workflow policy.

The stream gateway checks active status, recipient, start/stop time, and minimum rate. Direct receipt-hash acceptance is disabled. Production service access additionally needs an authenticated payer/session design and durable usage accounting. Guarded settlement is a separate explicit payment path.

## Browser agent drafts

Agent setup (`/agent`) validates non-secret configuration, saves a browser-local draft and generates a guarded SDK example. It neither reads a signer nor publishes a workflow/policy. [Draft behavior](docs/AGENT_SETUP.md) and [guarded client API](docs/sdk/guarded-payment-client.md).
