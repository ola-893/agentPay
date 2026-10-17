# Smart contract reference

AgentPay contracts are source/test artifacts until you deploy them. These docs do not claim public consumer/settlement/stream deployments or verified explorer addresses.

| Contract | Role |
| --- | --- |
| [AgentPayGuard](guarded-settlement.md) | Strict forwarder/workflow identity and bounded single-use payment authority |
| [AgentPaySettlement](guarded-settlement.md) | Atomic authorization consumption plus token transfer |
| [AgentPaySimulationReceiver](guarded-settlement.md) | Separate record-only mock-forwarder demo, cannot settle |
| [AgentPayStream](agentpaystream.md) | Legacy per-second stream escrow |
| [MockUSD](mock-usd.md) | 18-decimal public-mint tUSD test fixture |

Circle Sepolia USDC (6 decimals) is an existing Circle deployment for the guarded path, not a contract deployed by this repo. [Token/feed addresses](../USDC_SEPOLIA.md). The legacy stream UI/SDK require 18-decimal MockUSD.

[Events and errors](events-errors.md) · [Deployment](../../DEPLOYMENT.md) · [Contract tests](../../test/AgentPayGuard.test.js)
