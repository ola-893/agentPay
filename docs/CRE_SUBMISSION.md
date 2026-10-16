# CRE bounty submission: AgentPay

## Suggested project description

AgentPay adds deliberate spending controls to autonomous agent payments using Chainlink Runtime Environment. Its CRE Payment Guard fetches a real Coinbase USDC/USD quote, reads a finalized Chainlink USDC/USD feed on Ethereum Sepolia, checks freshness, source disagreement, deviation from the $1 peg and a per-request cap, then generates a bounded payment report. A consumer contract and SDK connect accepted onchain authorization to one token settlement. The frontend exposes captured ALLOW and DENY executions with inspectable inputs and transcripts.

## Requirement mapping

| Requirement supplied in the brief | Implementation and evidence |
| --- | --- |
| CRE as an orchestration layer | [Workflow](../cre/payment-guard/main.ts): cron → HTTP → EVM read → policy → report |
| At least one blockchain | Ethereum Sepolia, chain ID 11155111, finalized reads of the [Chainlink USDC/USD feed](https://sepolia.etherscan.io/address/0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E) |
| External API/system/source | Live Coinbase USDC/USD API, fetched by CRE HTTPClient with median aggregation |
| Successful simulation or deployment | [ALLOW transcript](evidence/cre-allow.log) and [budget DENY transcript](evidence/cre-deny-budget.log) |
| Workflow used in the project | Shared report ABI, AgentPayGuard, AgentPaySettlement, GuardedPaymentClient, and the frontend evidence viewer |

Both transcripts are real CRE CLI executions compiling the workflow to WASM and making live external API and public-chain calls. ALLOW requests 0.01 Circle Sepolia USDC (`10000` raw units) against a 0.1 cap (`100000`); DENY requests 0.2 (`200000`) against the same cap. USDC uses six decimals. Each source must be within 1% of $1, with at most 1% disagreement. [Verified addresses and freshness rationale](USDC_SEPOLIA.md).

## Reproduce

Follow [README](../README.md) for installation, CRE authentication, and commands. The direct CLI command from `cre/` is:

```sh
cre workflow simulate payment-guard --target staging-settings --trigger-index 0 --non-interactive
```

`npm run cre:simulate -- --deny-budget` creates an ignored config copy under `.local/cre/`, raises the amount, and invokes the same CLI with `--config`. It does not change the workflow or policy thresholds. The wrapper verifies a successful CLI exit and expected result before saving evidence. Failed executions do not replace successful captures.

- [ALLOW JSON](evidence/cre-allow.json) / [DENY JSON](evidence/cre-deny-budget.json)
- [Policy tests](../cre/payment-guard/policy.test.ts)
- [Consumer/settlement tests](../test/AgentPayGuard.test.js)
- [Guarded client tests](../sdk/test/guarded-payment.test.ts)
- [Browser capture](evidence/usdc-dashboard-deny.jpg)

JSON captures include a config SHA-256 and sanitized CLI transcript SHA-256. Transcripts also contain the binary/config hashes printed by CRE. The encodedReport field is an ABI report body, not a reusable signed credential. Local capture time and CRE runtime observation time are recorded separately. These observations are historical evidence.

## Verification

- 27 contract tests pass: origin, destination, expiry, replay, party/token/amount binding, denied reports, transfer rollback, and owner workflow binding.
- 49 SDK tests pass, including authorization before token approval and recipient validation before signing.
- Eight gateway tests pass, including fabricated hashes and wrong recipients.
- Eleven deterministic CRE policy tests and eleven host-side evidence/tooling checks pass.
- SDK build, CRE typecheck, frontend build and frontend lint pass.
- Browser verified: scenario switch renders DENY with 0.2 requested versus a 0.1 cap; CRE documentation opens; no browser console errors or warnings appeared on this flow.

## Demonstrated scope

This submission uses the **successful simulation** path in the supplied brief. It does not claim live DON deployment or public-network settlement. Consumer and settlement behavior is tested separately on Hardhat with a simulated trusted forwarder.

The live-read workflow uses placeholder payment parties, zero receiver and no publication. The consumer keeps identity validation enabled: CRE's simulation mock forwarder lacks production identity metadata. See [deployment instructions](../DEPLOYMENT.md) for a real deployment.

The sample is one cron-driven payment intent. Real payments need fresh request IDs and real configuration. Rolling budgets, KYC, confidential execution, multi-chain settlement and a complete x402 transport are not shipped features.

## Recording readiness and optional write

Follow [the readiness guide](RECORDING_READINESS.md) before recording. It runs both npm scenarios live and verifies freshness headroom without replacing the existing backup captures. The policy now checks the payment asset itself: Circle Sepolia USDC with six-decimal units, independently observed USDC/USD prices and an explicit $1 peg bound. Testnet USDC has no monetary value.

The latest versioned preflight transcripts are linked in that guide; previous ETH/USD captures are retained under content-addressed backups and are historical evidence of the earlier policy, not the current USDC workflow. A separate simulation-only receiver and opt-in write runner are available. They do not weaken AgentPayGuard and cannot settle tokens. No public write has been performed; only a separately verified RPC receipt and matching receiver event may be presented as an Etherscan demo.

## Short demo sequence

1. Open the dashboard, select Within budget, and explain its API observation, finalized feed read, policy and ALLOW result.
2. Select Over budget and show DENY for 0.2 USDC requested against a 0.1 USDC cap, showing raw units and the six-decimal token address.
3. Open a CLI transcript, then run npm run cre:simulate to show compilation and a fresh live-data execution.
4. Show the consumer's replay/expiry checks, guarded client preflight and tests. State that this entry demonstrates simulation.

Confirm the organizer's current deadline and other submission requirements, and ensure judges can access the repository. This work has not changed repository visibility or submitted an entry.

## Official references

- [Circle USDC deployments](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Circle test USDC faucet](https://faucet.circle.com/)
- [Chainlink Price Feed Addresses: Ethereum Sepolia](https://docs.chain.link/data-feeds/price-feeds/addresses)
- [CRE overview](https://docs.chain.link/cre/overview)
- [TypeScript SDK](https://github.com/smartcontractkit/cre-sdk-typescript)
- [Templates](https://github.com/smartcontractkit/cre-templates)
- [HTTP client](https://docs.chain.link/cre/reference/sdk/http-client-ts)
- [EVM client](https://docs.chain.link/cre/reference/sdk/evm-client-ts)
- [Consumer contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts)
