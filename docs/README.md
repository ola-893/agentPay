# AgentPay documentation

Welcome to AgentPay — **reusable USDC streams with deterministic Chainlink CRE payment guardrails.**

AgentPay addresses the N+1 payment problem: many paid API requests should share one funded session. CRE adds fixed rules around the agent's financial actions, helping prevent duplicate funding and continued payment through an observed outage.

**[Open the dashboard](https://agentpay-cre.netlify.app)** · **[Project overview](../README.md)** · **[Manual demo script](../demo/demo_script.md)**

## What is AgentPay?

An AI agent proposes a paid service request. Local CRE workflows check USDC price safety, service health, budgets and stream state. A separate policy signer approves eligible OPEN/CLOSE actions, and the escrow verifies those approvals. Requests then reuse the funded stream; cancellation settles time-accrued earnings and refunds unused escrow.

**The agent proposes. CRE checks the rules. The contract enforces approved stream actions.**

## Key innovation

**One funded stream, many API requests, zero payment transactions per request.**

| Transaction-per-request approach | AgentPay approach |
| --- | --- |
| Each request submits a payment | Requests reuse an authenticated stream |
| Repeated payment transactions | Open and close; token approval when needed |
| Unchecked model-generated payment actions | Deterministic CRE decisions and signed lifecycle approvals |
| Missing decision history | Durable decision blobs and onchain hash receipts |

Token approvals, withdrawals and audit receipts also use gas. Earnings accrue per second until cancellation is mined. Checkpoints are explicit demo steps. [Accounting, authority and trust boundaries](architecture/README.md).

## Quick links

- [Getting started](getting-started/README.md)
- [Architecture](architecture/README.md)
- [Smart contracts](contracts/README.md)
- [SDK reference](sdk/README.md)
- [CLI setup and commands](AI_AGENT_DEMO.md)
- [CRE workflow](WORKFLOW.md)
- [Dashboard and live local setup](WORKFLOW_DASHBOARD.md)
- [CLI event reference](EVENT_SCHEMA.md)
- [Deployment guide](../DEPLOYMENT.md)

## Current deployment — Ethereum Sepolia

| Contract | Address |
| --- | --- |
| Circle USDC · 6 decimals | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| AgentPayGuardedStream | `0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09` |
| AgentPayDecisionJournal | `0xa1A5BA33bebdDe7EcA55BDe252568C9D16C4Da87` |

[Verified escrow deployment and authorities](deployment/guarded-usdc-stream.json) · [Journal deployment](deployment/decision-journal.json) · [USDC units and feed](USDC_SEPOLIA.md).

The current guarded escrow is bound to the registered demo agent. The [legacy tUSD SDK](sdk/README.md) uses a separate 18-decimal token and contract. The [strict guarded settlement reference](sdk/guarded-payment-client.md) is another authorization path; its public guard remains closed and is not used by the streaming CLI.

## Features

- **Deterministic policy:** CRE returns OPEN, CONTINUE, CLOSE or DENY from external observations and blockchain state.
- **Reusable streams:** Many authenticated requests share a time-based USDC escrow session.
- **Contract enforcement:** Separate policy signatures bind agent OPEN/CLOSE to exact intents, nonces and expiry.
- **Spend checks:** Dry-run proposed business transactions and apply risk/hard-rule gates before signing.
- **Decision receipts:** Persist decision records, including blocks, to durable local blobs and anchor hashes onchain.
- **Refund verification:** Reconcile cancellation receipts, events and balance changes.
- **Workflow dashboard:** Inspect captured events and CRE transcripts, or run the CLI locally with credentials kept on the server.

The hosted frontend provides recorded replay and Docs. CRE executes locally; the contract verifies the policy signer. The gateway implements AgentPay-specific HTTP 402 negotiation inspired by x402. [Full workflow](WORKFLOW.md) · [Guarded setup and recovery](GUARDED_STREAMS.md).

## Evidence and further reading

| Goal | Guide |
| --- | --- |
| Configure wallets, units and model credentials | [Configuration](getting-started/configuration.md) |
| Review fresh frontend-triggered payment evidence | [October 30 verification](evidence/frontend-live-2026-10-30/VERIFICATION.md) |
| Inspect dry-runs, risk scores, blobs and receipts | [Spend audit](SPEND_AUDIT.md) |
| Explore paid quality trials | [ToolBuyer](TOOLBUYER.md) |
| Check commands, output and exit codes | [CLI contract audit](CLI_AUDIT.md) |
| Review claims and documentation drift checks | [Documentation correctness audit](DOCUMENTATION_AUDIT.md) |
| Inspect reliability checks and verification limits | [Reliability audit](RELIABILITY_AUDIT.md) |
| Review bounty requirements and CRE evidence | [Submission guide](CRE_SUBMISSION.md) |
| Fix setup or execution failures | [Troubleshooting](reference/troubleshooting.md) |
| Browse all guides | [Table of contents](SUMMARY.md) |

## Project links

- [Live dashboard](https://agentpay-cre.netlify.app)
- [GitHub repository](https://github.com/ola-893/agentPay)
- [Frontend documentation source](../vite-project/src/lib/documentation.mjs)

AgentPay is an independent, unaudited Sepolia prototype. No CRE workflow is deployed to a DON. Testnet tokens have no monetary value.
