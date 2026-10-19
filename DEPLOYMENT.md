# AgentPay setup and deployment

## Simulation and frontend

The supported CRE journey is local CLI simulation. Workflow deployment to Chainlink's network and the DON-authorized public USDC payment test are outside scope; deployment approval is not a prerequisite for running the project.

Recorded evidence and read-only CRE simulation require no deployed AgentPay contracts. Follow [README](README.md). The RPC is in `cre/project.yaml`; use a reliable Sepolia HTTPS endpoint if the public RPC is busy.

`npm run build:web` produces `vite-project/dist`, a static React app with evidence JSON from `public/evidence`. Preserve the SPA fallback (`_redirects` / `netlify.toml`) when hosting. No hosting deployment is included in the recorded evidence.

## Separate simulation-only write demo

See [recording readiness](docs/RECORDING_READINESS.md) for the optional `AgentPaySimulationReceiver`, its dedicated Sepolia test wallet, explicit identity-skip opt-in, and receipt-verified broadcast runner. It records a mock-forwarder demo but cannot authorize or settle payments. No demo deployment or broadcast was performed during this repository update.

## Existing guard and settlement contracts

The [Sepolia contract record](docs/deployment/guarded-usdc.md) retains public guard/settlement addresses and successful deployment/binding receipts. Those contracts remain deployed with reporting closed. The live workflow target, network-deployment instructions and public DON payment-test procedure have been removed; no workflow deployment or workflow-ID binding is planned.

Contract and SDK authorization behavior remains covered by local tests. See the [guarded client reference](docs/sdk/guarded-payment-client.md) for the implemented API and prerequisites. A local simulation's ALLOW output is not onchain payment authority. No additional contract deployment or USDC payment is required for the local CRE simulation journey.

## Legacy stream deployment

The [confirmed Sepolia stream deployment](docs/deployment/sepolia.md#confirmed-project-deployment) provides current public addresses and receipt/bytecode evidence. Only local ignored environment files are automatically configured; new checkouts must supply their own settings.

`npm run deploy:sepolia` deploys new AgentPayStream and MockUSD contracts. Do not reuse old addresses: the new ABI uses `paymentToken()`.

Server/demo: set `AGENTPAY_STREAM_ADDRESS`, `PAYMENT_TOKEN_ADDRESS`, and `PAYMENT_RECIPIENT_ADDRESS` in `.env`. Frontend: set `VITE_CONTRACT_ADDRESS` and `VITE_PAYMENT_TOKEN_ADDRESS` in `vite-project/.env.local`, then restart Vite. Without both nonzero addresses, Streams shows setup guidance. [Frontend usage](vite-project/README.md).

The guarded workflow pins Circle Sepolia USDC, its six decimals and the matching USDC/USD feed/API. Do not change only the token address to support another asset. [USDC policy setup and faucet](docs/USDC_SEPOLIA.md).

The original stream UI and SDK assume 18-decimal test tokens; do not point them at 6-decimal USDC. The new guarded client accepts integer token units, with the matching units required in workflow policy.

The stream gateway checks active status, recipient, start/stop time, and minimum rate. Direct receipt-hash acceptance is disabled. Production service access additionally needs an authenticated payer/session design and durable usage accounting. Guarded settlement is a separate explicit payment path.

## Browser agent drafts

Agent setup (`/agent`) validates non-secret configuration, saves a browser-local draft and generates a guarded SDK example. It neither reads a signer nor publishes a workflow/policy. [Draft behavior](docs/AGENT_SETUP.md) and [guarded client API](docs/sdk/guarded-payment-client.md).
