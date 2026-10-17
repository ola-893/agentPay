# Quick start

## Explore the current app

```sh
npm run install:all
npm run dev
```

Open the Vite URL from the terminal.

- **CRE Workflow (`/`):** switch Within budget / Over budget; inspect the requested USDC amount, cap, price observations and report status. Copy the selected npm command or open the raw JSON/transcript.
- **Agent setup (`/agent`):** enter contract/recipient addresses and a USDC amount, save a local draft and copy an SDK example. This does not start an agent or change onchain policy.
- **Streams (`/streams`):** shows setup guidance until legacy stream/token addresses and a wallet are available.
- **Docs (`/docs`):** installation, workflow, USDC policy, agent setup, SDK, streams and troubleshooting in the app.

Saved captures are historical, explicitly labeled simulations. The browser does not fetch live market prices or use a saved ALLOW as spend authority.

## Run live read-only CRE scenarios

With Bun, installed workflow dependencies and authenticated CRE CLI:

```sh
npm run install:cre
cre login
npm run cre:dry-run
npm run cre:simulate
npm run cre:simulate -- --deny-budget
```

ALLOW requests `10000` raw units (0.01 USDC) against `100000` (0.1). Budget DENY requests `200000` (0.2). Live prices and feed freshness can trigger another denial; the runner refuses to claim the expected outcome if that occurs.

To refresh saved frontend and submission evidence:

```sh
npm run cre:capture
npm run cre:capture -- --deny-budget
```

Prior captures are backed up before successful replacement. These commands do not broadcast. [Workflow](../WORKFLOW.md) and [recording guide](../RECORDING_READINESS.md).

## Prepare a guarded USDC payment

[Agent setup](../AGENT_SETUP.md) generates an integration example with exact six-decimal raw units. A payment still requires real deployments, a connected Sepolia signer and a fresh authenticated report accepted by the production guard. Use [GuardedPaymentClient](../sdk/guarded-payment-client.md), not the legacy streaming SDK, for this path.

For tUSD streams instead, follow [stream setup](../architecture/payment-streams.md). Circle USDC is not supported in the legacy stream UI or SDK. Testnet tokens have no monetary value.
