# Short-demo claim → evidence map

All run figures, addresses and transaction hashes are generated from
vite-project/public/runs/20261022T112249Z-556c7ea3/events.ndjson by build-data.mjs.
The generated data.js records its SHA-256. The thousand-call hook is the motivating
illustration; the recorded demonstration contains ten successful calls.

| Chapter | What viewers see | Raw source |
| --- | --- | --- |
| Fund once | Many paid calls reuse a funded session | AgentPayStream.sol, demo/agent-demo.mjs; hypothetical hook from project brief |
| Streaming payments | Agent, wallet, escrow and paid-service loop | Stream contract time-based accrual and CLI session integration |
| Why CRE | Fixed rules over API observations + chain reads produce OPEN / CONTINUE / CLOSE / DENY | cre/payment-guard/main.ts, stream-main.ts, stream-policy.ts; recorded cre.result events |
| Real workflow | Source snippets and saved CLI output | Build-time exact source extraction; artifacts/02-cre-price.log |
| Recorded run | Approval/open, ten successes, healthy checkpoint, injected outage, cancel | NDJSON wallet.tx, api.reuse, fault and cre.result events |
| Settlement | Earned/refund split, recipient increase, four audit receipts | NDJSON seq 37/44 and audit.receipt events; docs/evidence/workflow-dashboard/rpc-verification.json |
| Budget control | 0.2 premium quote vs 0.1 USDC deposit cap, DENY | NDJSON seq 41; admission policy AMOUNT_EXCEEDS_POLICY branch |
| Build with AgentPay | Repository and exact reproduction commands | Root README.md string checks at build |

Execution context stays precise in neutral labels: recorded Sepolia run, CRE local
simulation, onchain wallet transactions. The wallet CLI applies signing policy;
the stream contract provides escrow accounting and settlement. Decision audit
receipts are separate transactions. This cut makes no DON execution, onchain CRE
verification, gas-savings, full x402, or unprompted-strategy claim. The basic and
premium trials are identified as prompted. No current prices are implied by replay.

The guardrail claim is scoped to the managed CLI: the model proposes a service tier
and purpose, the host owns financial parameters and reuse, CRE evaluates fixed
rules, and the CLI validates the result before signing. This reduces avoidable
spending; it is not added AI intelligence, a continuous monitor, an aggregate
wallet budget, or a guarantee against every loss. Explicit recovery closure remains.
