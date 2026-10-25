# Workflow dashboard: local runs and recorded replay

The dashboard visualizes deterministic payment guardrails: the agent proposes work, CRE evaluates fixed rules, and the CLI applies checked outcomes. It helps inspect how session reuse, continuation, closure and budget denial follow policy rather than free-form model text. The browser displays emitted results; it does not evaluate payment policy.

Workflow (`/`) contains the CRE diagram, locally registered agent, bounded policy form, execution timeline and amount/transaction summary. Docs remains the only other navigation destination. Agent, stream-management and dashboard routes were not restored.

The diagram has external-input chips feeding CRE above the Agent → Wallet → Escrow → Paid service row. Dashed CRE edges show signing gates, chain reads and health probes; the bottom arc shows session reuse. Its gauge changes only on emitted funding/closure/summary events. The browser copies decisions from events and never evaluates the policy. Monetary values are integer-safe observations, not a simulated earnings counter. Mobile uses a vertical stepper driven by the same presentation state.

## Recorded mode

A hosted static page defaults to recorded evidence. Select a scenario chip, replay/pause/step/restart, expand a compact timeline row, copy its exact command and open its original config/transcript. Hover or focus a row to highlight the relevant diagram nodes; click a node to find its most recent visible event. Wallet cards link to Sepolia transactions. Each replay carries its capture date and never submits a transaction. The locked 2×2 “Policy used” summary shows the immutable capture policy; the remaining settings are in Details. There are no policy inputs in Recorded mode. Changing a scenario selects actual different evidence, not a browser-generated decision.

The browser never contacts a visitor's localhost from a hosted build. Only local Vite development checks its same-origin `/api`, proxied to the loopback run server. A static build supports Recorded execution only, even when served locally. Its Live tab shows local setup instructions without probing localhost.

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

Live mode puts deposit cap, maximum feed age and failure threshold first; rate and both basis-point tolerances are under Advanced. USDC cap/rate inputs use six-decimal amounts converted to integer strings; the backend request is unchanged. ETH balances are truncated to four decimal places, with full wei in a tooltip. The six editable policy fields are bounded server-side: deposit cap 1–100000 raw, rate 1–100 raw/s, peg and disagreement tolerances 1–100 bps, maximum feed age 60–86400 seconds, failure threshold 1–3. The quote stays fixed at 0.01 USDC over 1000 seconds; recipient, token, escrow and planner are not form inputs. Reset restores the registered defaults. No sub-basis-point peg preset is offered.

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

## Compact presentation and evidence limits

The three trust chips link to the full CRE authority model. Test USDC, simulation/testnet and unaudited/not-full-x402 labels remain visible; detailed prerequisites and limitations stay in Docs. The summary counts lifecycle plus observed audit-receipt transactions, with their split in its tooltip. Audit rows are under Show advanced. Historical captures that omit wallet nonce observations show call counts without inventing a “0 txs” badge. A zero-transaction reuse badge requires that evidence in an event. Animation is event-triggered and disabled by reduced-motion preference; reduced-motion replay applies the captured state instantly.
