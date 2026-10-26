# Smart contract reference

The current AgentPayGuardedStream is deployed on Sepolia with [runtime/authority evidence](../deployment/guarded-usdc-stream.json) and a [verified signed lifecycle](../evidence/guarded-stream/VERIFICATION.md). Source/runtime comparison is not explorer source verification or an audit. Strict settlement and legacy deployments remain distinct.

| Contract | Role |
| --- | --- |
| [AgentPayGuardedStream](../GUARDED_STREAMS.md) | Current local-policy-signed USDC escrow; separate operator recovery |
| [AgentPayGuard](guarded-settlement.md) | Strict forwarder/workflow identity and bounded single-use payment authority |
| [AgentPaySettlement](guarded-settlement.md) | Atomic authorization consumption plus token transfer |
| [AgentPaySimulationReceiver](guarded-settlement.md) | Separate record-only mock-forwarder demo, cannot settle |
| [AgentPayStream](agentpaystream.md) | Legacy per-second stream escrow |
| [MockUSD](mock-usd.md) | 18-decimal public-mint tUSD test fixture |

Circle Sepolia USDC (6 decimals) is an existing Circle deployment for the guarded path, not a contract deployed by this repo. [Token/feed addresses](../USDC_SEPOLIA.md). The legacy SDK requires 18-decimal MockUSD.

[Events and errors](events-errors.md) · [Deployment](../../DEPLOYMENT.md) · [Contract tests](../../test/AgentPayGuard.test.js)
