# AgentPay documentation

AgentPay orchestrates guarded **Circle USDC payments on Ethereum Sepolia** with Chainlink CRE. Its frontend shows recorded CLI decisions, provides a local agent integration draft, and keeps legacy tUSD streaming separate. This is an unaudited prototype; testnet tokens have no monetary value.

## Start here

| Goal | Guide |
| --- | --- |
| Run the frontend without a wallet | [Quick start](getting-started/quick-start.md) |
| Install dependencies and verify the repo | [Installation](getting-started/installation.md) |
| Understand configuration and units | [Configuration](getting-started/configuration.md) |
| Reproduce ALLOW and DENY | [CRE workflow](WORKFLOW.md) |
| Verify USDC address, feed and peg policy | [Sepolia USDC](USDC_SEPOLIA.md) |
| Run a real Qwen/OpenAI purchasing agent | [AI agent CLI](AI_AGENT_DEMO.md) |
| Use the Agent setup page | [Local agent draft](AGENT_SETUP.md) |
| Settle an authenticated report | [GuardedPaymentClient](sdk/guarded-payment-client.md) |
| Deploy the consumer or legacy streams | [Deployment](../DEPLOYMENT.md) |
| Fix setup or execution failures | [Troubleshooting](reference/troubleshooting.md) |
| Review bounty evidence and limits | [Submission guide](CRE_SUBMISSION.md) |
| Check consequential claims and reproduced results | [Documentation correctness audit](DOCUMENTATION_AUDIT.md) |
| Inspect command flags, output, exit codes and CLI verification | [CLI contract audit](CLI_AUDIT.md) |

## Two payment paths

| | CRE guarded settlement | Legacy streaming |
| --- | --- | --- |
| Token | Circle Sepolia USDC, 6 decimals | Deployed MockUSD/tUSD, 18 decimals |
| Units | `0.01 USDC = 10000` | `1 tUSD = 1000000000000000000` |
| Client | `GuardedPaymentClient.pay` | `AgentPaySDK.makeRequest` / `createStream` |
| Contracts | `AgentPayGuard` + `AgentPaySettlement` | `AgentPayStream` + `MockUSD` |
| Frontend | Recorded workflow evidence and local SDK draft | Connected-wallet management, after deployment |

The gateway’s HTTP 402 headers are project-specific. Neither path is a complete current x402 transport/facilitator integration, and guarded settlement does not automatically grant gateway access. [Architecture and trust boundaries](architecture/README.md).

The [frontend docs](../vite-project/src/lib/documentation.mjs) describe the same supported flows with copyable commands and examples. [Table of contents](SUMMARY.md) links only to existing guides. Historical migration files and saved earlier captures remain provenance, not current setup instructions.
