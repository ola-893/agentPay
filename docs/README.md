# AgentPay documentation

**Current guarded deployment:** [AgentPayGuardedStream](GUARDED_STREAMS.md) requires a separate local policy signature for agent funding and closure. The policy process runs CRE itself; the agent cannot sign its own approval. The contract verifies exact intent, nonce and expiry, and blocks duplicate active funding. A separate operator key provides recovery. CRE remains local; this is not DON authentication. Earlier captured runs below use the legacy stream and demonstrate CLI-only enforcement.

The agent proposes useful work; CRE checks fixed payment rules; the CLI applies the checked result. A model-generated instruction is not payment approval. The guardrails address avoidable loss from unchecked funding and continuation, while one validated session serves many requests. Start with [the guardrail architecture](architecture/README.md) or [the manual demo script](../demo/demo_script.md).

AgentPay uses prepaid **Circle USDC streams on Ethereum Sepolia**, protected in the CLI by deterministic local Chainlink CRE guardrails. Many service requests reuse one funded stream; cancellation pays accrued earnings and refunds unused escrow. The AI CLI runs this lifecycle. The frontend contains only Workflow and Docs, with a CRE diagram, recorded replay, local CLI execution controls and instructions. Testnet tokens have no monetary value.

## The problem, and what CRE adds

An agent making 1,000 paid API calls should not need 1,000 blockchain payment transactions. At an illustrative $5–$50 in gas per transaction, that would mean $5,000–$50,000 before service fees; these are example costs, not current fee estimates. This N+1 payment problem motivated AgentPay's HTTP 402/x402-inspired model: escrow once, then reuse a time-based stream across many authenticated requests.

Streaming amortizes payment transactions. It also creates a control problem: earnings keep accruing if the service stops responding. CRE supplies the decisions around the stream:

| Problem left after streaming | What local CRE checks | How the CLI acts |
| --- | --- | --- |
| Funding an unhealthy or over-budget service | HTTP health observations, USDC price safety, Sepolia token/balance state, deposit and rate limits | `OPEN` or `DENY` before funding; renew expired admission through fresh checks |
| Continuing to pay through an observed outage | Provider/client counters and the matching onchain stream at explicit checkpoints | `CONTINUE`, or `CLOSE` followed by wallet cancellation and earned/refund reconciliation |
| Signing a bad spend or losing its explanation | RPC dry-run, exact intent, raw units, recipient, caps and a risk heuristic | Require a spend ALLOW, durable blob and confirmed onchain inclusion before signing; retain blocks/errors and anchor remaining decisions in batches |

CRE stays local. The CLI enforces its spend-review policy; the guarded contract additionally requires signed lifecycle approvals. A payer cannot bypass that contract gate with an unsigned create/cancel call. Earlier legacy contracts remain callable without CRE. Checkpoints are explicit demo steps, not continuous monitoring. Health observations do not establish answer quality. The separate [ToolBuyer benchmark](TOOLBUYER.md) explores paid quality trials with synthetic providers and benchmark credits; it is not a quality guarantee for the USDC demo.

Opening, approval when needed, cancellation and audit receipts still cost gas. This prototype neither promises fixed net savings nor implements the full x402 protocol. [How CRE supervises a stream](WORKFLOW.md) · [Verified full lifecycle and receipts](evidence/admission-fix/VERIFICATION.md).

## Start here

| Goal | Guide |
| --- | --- |
| Replay the workflow or run it locally | [Quick start](getting-started/quick-start.md) |
| Install dependencies and verify the repo | [Installation](getting-started/installation.md) |
| Use live/recorded dashboard modes | [Workflow dashboard](WORKFLOW_DASHBOARD.md) |
| Inspect the CLI event schema | [Events](EVENT_SCHEMA.md) |
| Understand configuration and units | [Configuration](getting-started/configuration.md) |
| Reproduce ALLOW and DENY | [CRE workflow](WORKFLOW.md) |
| Verify USDC address, feed and peg policy | [Sepolia USDC](USDC_SEPOLIA.md) |
| Dry-run spends, apply risk gates and verify blob receipts | [Spend audit](SPEND_AUDIT.md) |
| Compare paid quality trials and provider selection | [ToolBuyer](TOOLBUYER.md) |
| Run a real Qwen/OpenAI purchasing agent | [AI agent CLI](AI_AGENT_DEMO.md) |
| Settle an authenticated report | [GuardedPaymentClient](sdk/guarded-payment-client.md) |
| Deploy the consumer or legacy streams | [Deployment](../DEPLOYMENT.md) |
| Fix setup or execution failures | [Troubleshooting](reference/troubleshooting.md) |
| Review bounty evidence and limits | [Submission guide](CRE_SUBMISSION.md) |
| Check consequential claims and reproduced results | [Documentation correctness audit](DOCUMENTATION_AUDIT.md) |
| Inspect command flags, output, exit codes and CLI verification | [CLI contract audit](CLI_AUDIT.md) |

## Payment paths and examples

| Path | Asset and contract | Authority and interface |
| --- | --- | --- |
| AI streaming CLI | Circle Sepolia USDC, 6 decimals; USDC-configured AgentPayStream | Local CRE returns OPEN/CONTINUE/CLOSE/DENY; wallet funds or cancels; signed session reuses stream |
| Legacy SDK streams | MockUSD/tUSD, 18 decimals; separate AgentPayStream | Legacy AgentPaySDK; no browser stream management |
| Strict settlement reference | Circle USDC; AgentPayGuard + AgentPaySettlement | Requires authenticated onchain report; public guard remains closed and this is not the streaming CLI |

The HTTP 402 protocols are project-specific, not a complete x402 transport/facilitator integration. Guarded settlement does not automatically grant streaming gateway access. [Architecture and trust boundaries](architecture/README.md).

The [frontend docs](../vite-project/src/lib/documentation.mjs) describe the same supported flows with copyable commands and examples. [Table of contents](SUMMARY.md) links only to existing guides. Historical migration files and saved earlier captures remain provenance, not current setup instructions.
