# Workflow dashboard: local runs and recorded replay

Workflow (`/`) contains the CRE diagram, locally registered agent, bounded policy form, execution timeline and amount/transaction summary. Docs remains the only other navigation destination. Agent, stream-management and dashboard routes were not restored.

The diagram distinguishes the decision path (agent → CRE → wallet → escrow → service), the many-request reuse loop, and the observations → CRE → cancellation loop. It is explanatory; monetary values come from events, not a simulated earnings counter.

## Recorded mode

A hosted static page defaults to recorded evidence. Select a capture, replay/pause/restart, inspect each CRE card, copy its exact command and open its original config/transcript. Wallet cards link to Sepolia transactions. Each replay carries its capture date and never submits a transaction. The form shows that capture's immutable policy; changing a recorded run selects actual different evidence, not a browser-generated decision.

The browser never contacts a visitor's localhost from a hosted build. Only local Vite development checks its same-origin `/api`, proxied to the loopback run server. A static build remains recorded-only even when served locally.

## Live local mode

Configure the existing CLI prerequisites in ignored root `.env`: funded Qwen/OpenAI key, dedicated test-wallet key, recipient, Sepolia RPC and USDC stream deployment. The [registered profile](../demo/agents/treasury-research.json) must match those public addresses. “Registered locally” means this file, not an onchain registry. Compile contracts if artifacts are absent, install CRE/Bun and authenticate:

```sh
npm run install:cre
npx hardhat compile
cre login
npm run dev:live
```

Open `http://127.0.0.1:5317/`. The local server binds `127.0.0.1:5318`; the Vite proxy keeps browser requests same-origin. Stop an existing Vite instance on port 5317 before starting the combined command.

Choose **Live local**, then **Run · Preview**. Preview performs real model/CRE/HTTP/Sepolia reads and persists decision blobs without signing. Try **Tiny cap** (9999 raw against the fixed 10000 request) or **Stale feed** (60 seconds); the latter depends on observed feed age. A policy DENY is a completed policy outcome, not an execution error. CLI executions now return success for a validated price-policy denial; network, SDK and execution/validation failures remain failures.

The six editable policy fields are bounded server-side: deposit cap 1–100000 raw, rate 1–100 raw/s, peg and disagreement tolerances 1–100 bps, maximum feed age 60–86400 seconds, failure threshold 1–3. The quote stays fixed at 0.01 USDC over 1000 seconds; recipient, token, escrow and planner are not form inputs. Reset restores the registered defaults. No sub-basis-point peg preset is offered.

For an optional real testnet run, explicitly opt in on the server:

```sh
PAY_ENABLED=1 npm run dev:live
```

The dashboard then also requires Pay selection and confirmation for each run, at least 0.01 test USDC plus 0.001 Sepolia ETH observed at preflight, and the CLI's independent maximum of 0.01 USDC escrowed. Approval, lifecycle and receipt transactions spend test ETH. Actual gas availability is checked again by transaction preparation; the minimum balance is not a gas-price guarantee. Use only a dedicated test wallet. Server startup alone never submits a payment.

The local API enforces exact Host/Origin allowlists, JSON-only mutations with a server-generated session token, a strict request schema and one run at a time. Keys stay in the CLI/server environment. Do not expose this unauthenticated local service through tunnels or a public bind. The intended trust boundary is a user on the same computer. A disconnected browser does not cancel a running CLI; reconnect its timeline before starting another payment. Server shutdown stops new requests and leaves an active child to complete normal cleanup.

## Publish actual captures

From the repository root, with the same prerequisites:

```sh
npm run demo:capture
npm run demo:capture -- --preset tiny-cap
npm run demo:capture -- --preset stale-feed
npm run demo:capture -- --pay
npm run docs:check
```

These commands really call the model and CRE; `--pay` creates a real new test-USDC stream. There is no offline fabricated capture. Unexpected live inputs or execution failure do not replace the index. Only original event-emitter output and referenced public configs/transcripts are copied into `vite-project/public/runs/`. Private model responses and root environment files are never exported. [Event schema](EVENT_SCHEMA.md).

## Authority and limits

CRE is locally simulated; no workflow is deployed to a Chainlink DON. The CLI validates decisions and gates signing. AgentPayStream enforces escrow, accrual and cancellation payouts without checking CRE results. The provider checks a signed session and onchain stream state for API access. Spend rules and risk scores are transparent heuristics; health does not prove answer quality. Audit receipts prove inclusion of operator-submitted hashes, not independent truth of observations. Localhost health endpoints and per-run configs are simulation shortcuts. Cancellation only refunds unearned funds; detection, review and mining latency still accrue earnings. This is not full x402 and is an unaudited Sepolia prototype; test tokens have no monetary value.
