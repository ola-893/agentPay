# AgentPay

<img src="vite-project/public/agentpay.png" alt="AgentPay logo" width="96" />

**Fund once. Reuse safely. Deterministic payment guardrails with Chainlink CRE.**

AgentPay lets AI agents pay for API services through reusable USDC streams on Ethereum. Chainlink CRE checks fixed payment rules, helping prevent costly mistakes when an agent hallucinates a financial action.

**[Try the dashboard](https://agentpay-cre.netlify.app)** · **[Documentation](docs/README.md)** · **[CLI demo](docs/AI_AGENT_DEMO.md)**

## What is AgentPay?

An agent making 1,000 paid API calls should not need 1,000 blockchain payment transactions. AgentPay escrows a deposit once, then lets authenticated requests reuse a time-based payment stream.

But streaming also needs supervision. An agent might propose duplicate funding, keep paying an unavailable service, or close a useful session too early. **Agents already have intelligence. What their money needs is deterministic guardrails.**

Chainlink CRE combines external API observations with blockchain state to check prices, service health, spending limits and the existing stream. It returns `OPEN`, `CONTINUE`, `CLOSE` or `DENY`. A separate policy signer approves eligible OPEN/CLOSE actions; the escrow contract verifies those signatures when the agent submits them.

**The agent proposes. CRE checks the rules. The contract enforces approved stream actions.**

## Key innovation

**One funded stream serves many API requests, with no payment transaction per request.**

| Transaction-per-request approach | AgentPay approach |
| --- | --- |
| Each API request needs a payment transaction | Requests reuse an authenticated stream session |
| Repeated payment gas and confirmations | Open and close the stream; approve tokens when needed |
| The agent's proposed action drives spending | CRE evaluates deterministic rules; signed approvals gate OPEN/CLOSE |
| Spending explanations can be lost | Durable decision blobs with hashes anchored onchain |

The provider earns tokens per second while the stream runs. Cancellation settles accrued earnings and refunds unused escrow. Token approvals, withdrawals and audit receipts are additional transactions; actual gas costs depend on the run.

## How it works

1. **Request:** The agent encounters an HTTP 402 paywall and proposes a USDC service purchase.
2. **Check:** CRE compares Chainlink and Coinbase USDC prices, checks freshness, and evaluates service health, budget, rate and stream state.
3. **Fund:** A separate policy signer approves OPEN. After spend review, the agent submits the transaction and the escrow verifies the approval.
4. **Reuse:** API requests share the funded stream. A healthy checkpoint returns CONTINUE.
5. **Protect:** An observed outage triggers CLOSE. Confirmed cancellation pays accrued earnings and returns unused funds. An oversized purchase receives DENY.

CRE runs locally through the official CLI. The contract authenticates the separate policy signer; local simulation output alone cannot open or close the guarded stream. Checkpoints are explicit: earnings continue until cancellation is mined. [Architecture and enforcement](docs/architecture/README.md).

## Quick links

- [Getting started](docs/getting-started/README.md)
- [Architecture](docs/architecture/README.md)
- [CRE workflow and policy](docs/WORKFLOW.md)
- [Smart contracts](docs/contracts/README.md)
- [SDK reference](docs/sdk/README.md)
- [CLI commands and demo](docs/AI_AGENT_DEMO.md)
- [Workflow dashboard](docs/WORKFLOW_DASHBOARD.md)
- [Deployment guide](DEPLOYMENT.md)
- [Chainlink CRE submission and evidence](docs/CRE_SUBMISSION.md)

## Current deployment — Ethereum Sepolia

| Contract | Address |
| --- | --- |
| Circle USDC · 6 decimals | [`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |
| AgentPayGuardedStream | [`0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09`](https://sepolia.etherscan.io/address/0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09) |
| AgentPayDecisionJournal | [`0xa1A5BA33bebdDe7EcA55BDe252568C9D16C4Da87`](https://sepolia.etherscan.io/address/0xa1A5BA33bebdDe7EcA55BDe252568C9D16C4Da87) |

[Guarded escrow deployment](docs/deployment/guarded-usdc-stream.json) · [Decision journal deployment](docs/deployment/decision-journal.json) · [USDC units, feed and faucet](docs/USDC_SEPOLIA.md).

The checked-in escrow is bound to the registered demo agent and separate policy/recovery authorities. Configure the documented credentials or deploy your own instance before using a new wallet. Legacy 18-decimal tUSD streams remain a separate SDK path. [Setup and recovery](docs/GUARDED_STREAMS.md).

## Features

- **Deterministic CRE guardrails:** Price, freshness, service-health, deposit and rate checks govern payment decisions.
- **Reusable USDC streams:** Fund one session and reuse it across authenticated API requests.
- **Contract-verified approvals:** Exact OPEN/CLOSE intents are bound to a policy signature, nonce and expiry.
- **Spend review:** Dry-run proposed business transactions and apply CRE risk/hard-rule gates before signing.
- **Traceable decisions:** Store ALLOW, BLOCK and error records in durable local blobs; anchor returned decisions in onchain receipt batches.
- **Verified refunds:** Reconcile cancellation events and balances to confirm earnings and unused-deposit refunds.
- **Visual workflow dashboard:** Replay recorded runs, inspect original CRE evidence, or execute the CLI through the local runner.

The gateway uses AgentPay-specific HTTP 402 negotiation inspired by x402. [Protocol scope](docs/architecture/README.md) · [Spend review and receipt guarantees](docs/SPEND_AUDIT.md).

## Run locally

Use Node.js 22+, npm and Bun. From a cloned checkout:

```sh
npm run install:all
npm run install:cre
npm run dev
```

Recorded replay needs no wallet or credentials. The [hosted dashboard](https://agentpay-cre.netlify.app) provides recorded replay and Docs; live execution runs on your computer.

For fresh workflows, install the [official CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation), authenticate, then run the read-only price scenarios:

```sh
cre login
npm run cre:simulate
npm run cre:simulate -- --deny-budget
```

For the full AI purchasing demo, configure the model key, payer, RPC and separate policy authority using the [CLI setup guide](docs/AI_AGENT_DEMO.md):

```sh
# Preview admission checks without funding a stream
npm run --silent demo:agent

# Fund up to 0.01 USDC and demonstrate reuse, closure and refund
npm run --silent demo:agent -- --pay

# Run the local dashboard and CLI runner together
npm run dev:live
```

Paid runs use Sepolia USDC and test ETH for gas. Dashboard Pay also requires `PAY_ENABLED=1` at server startup and explicit confirmation. Keys stay in ignored local files. [Dashboard setup](docs/WORKFLOW_DASHBOARD.md).

## Verified demo

The October 30 frontend-triggered run funded **0.01 USDC**, served **10 successful API requests**, returned **CONTINUE**, then closed after **3 injected service failures**. Cancellation paid **0.0012 USDC** and refunded **0.0088 USDC**. The premium request was denied.

[Original results, receipts and browser evidence](docs/evidence/frontend-live-2026-10-30/VERIFICATION.md) · [Manual demo script](demo/demo_script.md) · [Two-minute recorded video script and edit](video/recorded-demo-1030/README.md).

The two-minute recording shows a separate completed run, stream #9, with its own observed payout and refund. Saved captures retain their original dates and amounts.

## Verify the project

```sh
npm run docs:check
npm test
npm run build:sdk
npm run typecheck:cre
npm run build:web
npm --prefix vite-project run lint
```

CI checks contracts, SDK, gateway, CRE policy, CLI tooling, documentation and the frontend using local fixtures. [Verification evidence and limits](docs/RELIABILITY_AUDIT.md).

## More workflows

[ToolBuyer](docs/TOOLBUYER.md) explores whether paid quality trials help choose a provider, counting trial costs against held-out baselines. It uses synthetic providers and benchmark credits. [Spend audit](docs/SPEND_AUDIT.md) documents transaction dry-runs, risk gates, durable storage and receipt verification.

## Project links

- [Live dashboard](https://agentpay-cre.netlify.app)
- [GitHub repository](https://github.com/ola-893/agentPay)
- [Documentation](docs/README.md)
- [AgentPay logo · PNG](vite-project/public/agentpay.png)

AgentPay is an independent, unaudited Sepolia prototype integrating Chainlink technology. CRE executes locally; no workflow is deployed to the Chainlink network. Testnet tokens have no monetary value. [Migration history](MIGRATION.md).
