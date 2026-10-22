# Quick start

## Explore the current app

```sh
npm run install:all
npm run dev
```

Open the Vite URL from the terminal.

- **Workflow (`/`):** read the N+1 problem and CRE supervision flow, switch Within budget / Over budget, inspect the saved USDC evidence and copy its reproduction command.
- **Docs (`/docs`):** read setup, workflow, USDC policy, CLI demo, SDK reference and troubleshooting. The frontend has no wallet connection, agent console or stream management.

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

## Run the payment demo from the CLI

Use the [AI CLI guide](../AI_AGENT_DEMO.md) to configure model credentials and the dedicated Sepolia wallet in ignored root `.env`. Preview without signing, then optionally fund a new 0.01 test-USDC stream:

```sh
npm run --silent demo:agent
npm run --silent demo:agent -- --pay
```

The paid run consumes test ETH for stream and audit-receipt transactions. The frontend does not execute these commands. The separate [strict SDK reference](../sdk/guarded-payment-client.md) requires authenticated onchain authorization; local CRE simulation cannot unlock that path. Testnet tokens have no monetary value.
