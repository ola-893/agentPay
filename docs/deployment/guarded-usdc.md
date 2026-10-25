# Existing Sepolia guard and settlement contracts

**AgentPay uses local CRE CLI simulation. Workflow deployment to Chainlink’s network, workflow-ID binding and the DON-authorized public USDC payment test are outside scope.** There is no pending network-deployment step or approval requirement for the supported simulation journey.

The strict guard and settlement contracts were deployed and connected on October 19, 2026. They remain on Sepolia; no workflow was deployed, no workflow ID was bound and no USDC payment was settled. Their existing identity checks remain enabled, with reporting closed.

| Contract | Address |
| --- | --- |
| AgentPayGuard | [0xf07af10A7Af5D3d6E5beF3B3f22195a89C257770](https://sepolia.etherscan.io/address/0xf07af10A7Af5D3d6E5beF3B3f22195a89C257770) |
| AgentPaySettlement | [0x8DB1bc06b9e448c8bB3fC95f12da55Da1e1f631A](https://sepolia.etherscan.io/address/0x8DB1bc06b9e448c8bB3fC95f12da55Da1e1f631A) |
| Trusted Sepolia forwarder | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |
| Recorded workflow ID | Zero; reporting closed |

The [deployment record](sepolia-guard.json) retains successful creation/binding receipts and runtime hashes. Onchain runtime matched the compiled contracts after masking compiler-declared immutable slots; owner, forwarder and reciprocal guard/settlement bindings were checked separately. This is comparison with local artifacts, not explorer source verification or a security audit. Recorded balances and request details are historical observations, not active test prerequisites.

The unused live workflow target, publishing configuration, public-chain test helper and deployment/resume instructions have been removed. The local `staging-settings` target and original successful ALLOW/DENY captures remain. The dedicated recipient wallet key stays only in ignored local storage; it is not required for simulation and must not be published.

For the current streaming demo, use [AgentPayGuardedStream at `0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09`](../GUARDED_STREAMS.md), with [its deployment record](guarded-usdc-stream.json). The AgentPayGuard/Settlement addresses above are a separate strict-settlement reference; they are not replacements for the streaming escrow.

## Supported verification

```sh
npm run cre:simulate
npm run cre:simulate -- --deny-budget
npm run cre:dry-run
npm run test:contracts
npm run test:sdk
```

The first three commands run CRE locally against external APIs and Sepolia reads. They need connectivity and CRE authentication, but no workflow deployment approval or funded wallet. Live inputs may cause a policy denial or execution failure. Contract and SDK tests use a local test chain; their reports do not establish public DON delivery or Circle USDC settlement.

## Historical evidence

These files record work already performed and are retained for traceability. They are not instructions to resume network deployment or required tests:

- [Successful WASM build](../evidence/guard-deployment/cre-build.log).
- [Previous deployment attempt](../evidence/guard-deployment/cre-deploy.log): the CLI submitted an access request and returned no workflow ID. No deployment resulted, and deployment is no longer planned.
- [Previous public-chain refusal check](../evidence/guard-deployment/payment-not-authorized.json): the SDK rejected an unauthenticated payment before approval; balances, allowance and wallet nonce were unchanged. Its runnable helper has been removed.
- [First failed preview](../evidence/guard-deployment/preview-first-attempt.log), [second failed preview](../evidence/guard-deployment/preview-second-attempt.log), and [preview configuration](../evidence/guard-deployment/preview-config.json): Coinbase exceeded its 10-second deadline. These did not publish reports or replace earlier successful staging captures.

See the [local workflow guide](../WORKFLOW.md) and [simulation-based submission](../CRE_SUBMISSION.md) for the current project journey.
