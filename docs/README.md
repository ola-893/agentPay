# AgentPay documentation

AgentPay uses prepaid **Circle USDC streams on Ethereum Sepolia**, supervised by local Chainlink CRE workflows. Many service requests reuse one funded stream; cancellation pays accrued earnings and refunds unused escrow. The AI CLI runs this lifecycle. The frontend retains recorded price-policy evidence, a local SDK draft, and the separate legacy tUSD stream UI. Testnet tokens have no monetary value.

## Start here

| Goal | Guide |
| --- | --- |
| Run the frontend without a wallet | [Quick start](getting-started/quick-start.md) |
| Install dependencies and verify the repo | [Installation](getting-started/installation.md) |
| Understand configuration and units | [Configuration](getting-started/configuration.md) |
| Reproduce ALLOW and DENY | [CRE workflow](WORKFLOW.md) |
| Verify USDC address, feed and peg policy | [Sepolia USDC](USDC_SEPOLIA.md) |
| Dry-run spends, apply risk gates and verify blob receipts | [Spend audit](SPEND_AUDIT.md) |
| Compare paid quality trials and provider selection | [ToolBuyer](TOOLBUYER.md) |
| Run a real Qwen/OpenAI purchasing agent | [AI agent CLI](AI_AGENT_DEMO.md) |
| Use the Agent setup page | [Local agent draft](AGENT_SETUP.md) |
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
| Existing browser/SDK streams | MockUSD/tUSD, 18 decimals; separate AgentPayStream | Connected wallet or legacy AgentPaySDK; retained original UI |
| Strict settlement reference | Circle USDC; AgentPayGuard + AgentPaySettlement | Requires authenticated onchain report; public guard remains closed and this is not the streaming CLI |

The HTTP 402 protocols are project-specific, not a complete x402 transport/facilitator integration. Guarded settlement does not automatically grant streaming gateway access. [Architecture and trust boundaries](architecture/README.md).

The [frontend docs](../vite-project/src/lib/documentation.mjs) describe the same supported flows with copyable commands and examples. [Table of contents](SUMMARY.md) links only to existing guides. Historical migration files and saved earlier captures remain provenance, not current setup instructions.
