# AgentPay setup and deployment

## Simulation and frontend

The supported CRE journey is local CLI simulation. Workflow deployment to Chainlink's network and the DON-authorized public USDC payment test are outside scope; deployment approval is not a prerequisite for running the project.

Recorded evidence and read-only CRE simulation require no deployed AgentPay contracts. Follow [README](README.md). The RPC is in `cre/project.yaml`; use a reliable Sepolia HTTPS endpoint if the public RPC is busy.

`npm run build:web` produces `vite-project/dist`, a static React app with evidence JSON from `public/evidence`. Preserve the SPA fallback (`_redirects` / `netlify.toml`) when hosting. No hosting deployment is included in the recorded evidence.

## AI agent USDC streaming demo

The [AI CLI demo](docs/AI_AGENT_DEMO.md) uses **AgentPayGuardedStream** on Ethereum Sepolia:

| Setting | Current deployment |
| --- | --- |
| Guarded escrow | [0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09](https://sepolia.etherscan.io/address/0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09) |
| Circle USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (6 decimals) |
| Environment | `AGENTPAY_USDC_STREAM_ADDRESS=0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09` |
| Deployment record | [Verified runtime, authorities and receipt](docs/deployment/guarded-usdc-stream.json) |

The contract requires a separate local policy signature for agent funding and closure. CRE stays local. Many API requests reuse the funded stream; closure pays accrued earnings and refunds unused escrow. [Guarded setup, keys and recovery](docs/GUARDED_STREAMS.md).

The existing deployment is already configured in `.env.example` and the registered profile. A fresh checkout must configure its own payer credentials and retain the deployment's separate operator policy/recovery keys to use this deployment. An address alone does not grant signing authority.

To deploy your own guarded instance, compile with `npm run test:contracts`, configure the dedicated Sepolia wallet, recipient and RPC, then run `npm run deploy:guarded-stream`. The script creates separate policy/recovery authorities and verifies the contract before updating local configuration. It refuses to overwrite an existing deployment record; inspect existing records and pending transaction hashes before redeploying. Deployment uses test ETH and does not deploy a token or CRE network workflow.

For interrupted guarded runs, inspect the transaction journal and use the separate operator command `npm run recover:guarded-stream -- --stream-id <id>`. The recovery owner needs Sepolia ETH; it bypasses CRE deliberately and cannot open a stream.

The [earlier unguarded USDC deployment](docs/deployment/usdc-stream.json) is retained for historical captures and legacy recovery. `deploy:usdc-stream` deploys that older contract and is not the deployment command for current paid agent runs. Existing tUSD deployments also remain separate; neither their constructor token nor their authorization rules can be changed by replacing an address.

## Separate simulation-only write demo

See [recording readiness](docs/RECORDING_READINESS.md) for the optional `AgentPaySimulationReceiver`, its dedicated Sepolia test wallet, explicit identity-skip opt-in, and receipt-verified broadcast runner. It records a mock-forwarder demo but cannot authorize or settle payments. No demo deployment or broadcast was performed during this repository update.

## Existing guard and settlement contracts

The [Sepolia contract record](docs/deployment/guarded-usdc.md) retains public guard/settlement addresses and successful deployment/binding receipts. Those contracts remain deployed with reporting closed. The live workflow target, network-deployment instructions and public DON payment-test procedure have been removed; no workflow deployment or workflow-ID binding is planned.

Contract and SDK authorization behavior remains covered by local tests. See the [guarded client reference](docs/sdk/guarded-payment-client.md) for the implemented API and prerequisites. A local simulation's ALLOW output is not onchain payment authority. No additional contract deployment or USDC payment is required for the local CRE simulation journey.

## Legacy stream deployment

The [confirmed Sepolia stream deployment](docs/deployment/sepolia.md#confirmed-project-deployment) provides the legacy tUSD addresses and receipt/bytecode evidence. Only local ignored environment files are automatically configured; new checkouts must supply their own settings.

`npm run deploy:sepolia` deploys new AgentPayStream and MockUSD contracts. Do not reuse old addresses: the new ABI uses `paymentToken()`.

Legacy server/demo: set `AGENTPAY_STREAM_ADDRESS`, `PAYMENT_TOKEN_ADDRESS`, and `PAYMENT_RECIPIENT_ADDRESS` in `.env` to the legacy tUSD deployment. The current frontend exposes Workflow and Docs; it does not use these legacy addresses for stream creation. [Frontend usage](vite-project/README.md).

The guarded workflow pins Circle Sepolia USDC, its six decimals and the matching USDC/USD feed/API. Do not change only the token address to support another asset. [USDC policy setup and faucet](docs/USDC_SEPOLIA.md).

The legacy SDK assumes 18-decimal test tokens; do not point it at the six-decimal guarded USDC deployment. The new guarded client accepts integer token units, with the matching units required in workflow policy.

The stream gateway checks active status, recipient, start/stop time, and minimum rate. Direct receipt-hash acceptance is disabled. Production service access additionally needs an authenticated payer/session design and durable usage accounting. Guarded settlement is a separate explicit payment path.

## Frontend configuration

The current Workflow page gets its registered escrow from the local runner or the selected recorded run. Docs identifies the current guarded deployment above. Older captures keep the addresses used when recorded. Agent setup and standalone Streams routes have been removed; [historical draft context](docs/AGENT_SETUP.md) and the separate [strict guarded client API](docs/sdk/guarded-payment-client.md) remain references.
