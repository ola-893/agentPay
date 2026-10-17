# Getting started

Choose the flow you need:

1. **Inspect evidence:** Node.js 22+ and npm; no wallet or deployment required. [Quick start](quick-start.md).
2. **Execute CRE:** also install Bun and the authenticated CRE CLI, and allow network access. [Workflow guide](../WORKFLOW.md).
3. **Prepare an agent:** use `/agent` to save a browser-local integration draft. [Agent setup](../AGENT_SETUP.md).
4. **Settle USDC:** requires deployed consumer/settlement/workflow, an accepted fresh authenticated report, a funded Sepolia signer, and Circle test USDC. [Guarded client](../sdk/guarded-payment-client.md).
5. **Manage streams:** requires newly deployed 18-decimal MockUSD and AgentPayStream plus frontend addresses. [Stream guide](../architecture/payment-streams.md).

Use [installation](installation.md) and [configuration](configuration.md) for exact commands and settings. AgentPay targets Ethereum Sepolia only; testnet tokens have no monetary value.
