# Quick start

## Explore the current app

```sh
npm run install:all
npm run dev
```

Open the Vite URL from the terminal.

- **Workflow (`/`):** explore the N+1 payment problem and deterministic CRE guardrails. Replay Funded run, Preview (no txs), Cap DENY or Stale DENY; inspect the policy observations and reproduction commands.
- **Docs (`/docs`):** read setup, workflow, USDC policy, CLI demo, SDK reference and troubleshooting. The frontend has no wallet connection, separate agent console or stream management. Workflow embeds local-run controls and recorded replay.

Captures are historical and labelled: local CRE simulation results may accompany real Sepolia transactions; replay itself signs nothing. The browser does not fetch live market prices or use a saved ALLOW as spend authority.

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

Use the [AI CLI guide](../AI_AGENT_DEMO.md) to configure registered operator model/wallet credentials and the separate policy key in ignored root `.env`. Preview without signing, then optionally fund a new 0.01 test-USDC stream:

```sh
npm run --silent demo:agent
npm run --silent demo:agent -- --pay
```

The paid run consumes test ETH for stream and audit-receipt transactions. The browser itself does not sign transactions; Live local delegates execution to the CLI. The separate [strict SDK reference](../sdk/guarded-payment-client.md) requires authenticated onchain authorization; local CRE simulation cannot unlock that path. Testnet tokens have no monetary value.

To use the local dashboard instead of the terminal runner, configure the same CLI settings, run `npm run dev:live`, open port 5317 and choose Live local. See [dashboard modes](../WORKFLOW_DASHBOARD.md). Hosted/static mode only replays captures.
