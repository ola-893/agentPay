# Getting started

1. **Replay evidence:** Node 22 and frontend dependencies; no keys. [Quick start](quick-start.md).
2. **Execute read-only CRE:** Bun, CRE dependencies, authenticated CLI and connectivity. [Workflow](../WORKFLOW.md).
3. **Run the agent:** registered payer/model credentials, policy key, local storage and Sepolia/RPC access. Paid mode also needs test USDC/ETH and receipt contract. [CLI guide](../AI_AGENT_DEMO.md).
4. **Recover guarded escrow:** separate operator recovery key and ETH, with no CRE/model prerequisite. [Guarded streams](../GUARDED_STREAMS.md).
5. **Inspect separate references:** [strict settlement SDK](../sdk/guarded-payment-client.md) or [legacy tUSD streams](../architecture/payment-streams.md). Neither is the current agent path.

Use [installation](installation.md) and [configuration](configuration.md) for commands.
A clean checkout can replay all public evidence but does not contain operator keys;
independent guarded deployment onboarding has not been verified. Ethereum Sepolia
only; test tokens have no monetary value.
