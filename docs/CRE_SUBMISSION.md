# CRE bounty submission: AgentPay

AgentPay addresses the transaction-per-request payment problem with prepaid escrow streams. An AI agent funds one stream, makes many service requests without additional payment transactions, and cancels when finished or when service fails. The provider earns tokens with time; unused escrow returns to the sender on cancellation.

CRE supervises that lifecycle. The workflow combines HTTP service observations with Ethereum Sepolia stream state and returns `OPEN`, `CONTINUE`, `CLOSE` or `DENY`. An initial CRE price workflow also compares live Coinbase USDC/USD with a finalized Chainlink USDC/USD feed. The agent wallet executes stream actions. This submission uses local CRE simulation, not a workflow deployed to Chainlink's network.

## Requirement mapping

| Requirement | Implementation |
| --- | --- |
| CRE orchestration inside the project | [Stream supervisor](../cre/payment-guard/stream-main.ts): HTTP observations + EVM reads → bounded lifecycle decision |
| At least one blockchain | Ethereum Sepolia; actual Circle USDC and AgentPayStream state |
| External API/system | HTTP provider-health snapshots outside the workflow; initial public Coinbase USDC/USD API plus Chainlink feed checks |
| Successful simulation or deployment | Real CLI simulations for admission, healthy continuation, outage closure and premium denial; no CRE network deployment required |
| Workflow used by the application | [AI CLI](../demo/agent-demo.mjs) consumes each decision and signs stream operations; API requests reuse its authenticated stream session |

## Demonstrate the original payment model

Follow the [AI streaming demo guide](AI_AGENT_DEMO.md) for credentials, public stream address and exact commands. Preview performs admission checks only. The funded demo:

1. A real Qwen/OpenAI model requests both research tiers.
2. CRE checks USDC price safety and basic stream admission.
3. The wallet approves as needed and deposits `10000` raw USDC (0.01) into AgentPayStream over 1000 seconds, earning `10` raw units per second.
4. Five API calls reuse that stream without a new payment transaction.
5. CRE fetches provider observations, corroborates client counters, reads the matching stream at an explicit Sepolia block and returns `CONTINUE`.
6. Five more requests reuse the same stream.
7. The demonstration explicitly injects a provider outage; three real requests return labeled HTTP 503 responses.
8. CRE returns `CLOSE`; the wallet cancels the stream. Contract events and balance snapshots establish time-accrued payment and unused-deposit refund.
9. Premium admission requests a `200000` deposit (0.2) against a `100000` cap (0.1) and is denied without signing.

The [USDC stream deployment record](deployment/usdc-stream.json) verifies the public contract runtime, token binding and deployment receipt. [Circle USDC units and feed rationale](USDC_SEPOLIA.md).

The CLI reports actual approval/open/close transactions separately. Reused API calls and CRE read-only checkpoints do not create payment transactions. No fixed dollar gas price or universal 98% savings is claimed; token approval and any recipient withdrawals must be counted when comparing costs.

## Verified Sepolia stream run

On October 20, 2026, Qwen and the local CRE CLI completed all four lifecycle decisions. Stream #1 escrowed 0.01 USDC, served ten successful requests with no per-request payment transactions, and closed after three explicitly injected HTTP 503 failures. Cancellation paid 0.0006 USDC in accrued earnings and refunded 0.0094 USDC. Approval, creation and cancellation were three actual transactions; no fixed gas-saving percentage is inferred.

[Original transcript](evidence/stream-demo/run.log) · [Result/model records](evidence/stream-demo/result.json) · [RPC receipts and historical balances](evidence/stream-demo/rpc-verification.json) · [Verification methods and limits](evidence/stream-demo/VERIFICATION.md).

[Stream creation](https://sepolia.etherscan.io/tx/0x81966282be0a35356f5b3de5835ce5c080270148a230c1116d3a251dea781746) · [Cancellation and refund](https://sepolia.etherscan.io/tx/0x3d22cd3855b6bc10c4cf29e9496630ff698d3697c85ea9c2f2e2db8d78a432ca).

## Trust and verification limits

- The local wallet enforces CRE decisions. A simulation is not DON consensus or onchain CRE authorization. AgentPayGuard and AgentPaySettlement remain closed/unused by this path.
- Service counters come from a co-located demo provider and client. Comparing them detects discrepancies but is not independent proof of service quality. The outage is injected, not a claimed real incident.
- Earnings accrue until cancellation is mined; outage detection cannot reverse already-earned amounts. Cancellation pays accrued earnings and refunds unused escrow in one contract transaction.
- Stream/wallet reads use an explicit recent block. The host waits two confirmations for writes; those writes are not claimed finalized. The separate Chainlink price-feed read is finalized.
- The provider requires a signed payer session bound to origin, quote and stream, along with onchain state checks. This is an AgentPay HTTP 402 protocol, not full x402.
- The frontend's recorded price decisions, local SDK draft and tUSD stream UI remain separate from the live AI streaming CLI. No browser live-agent telemetry is implied.
- Circle test USDC has no monetary value. Model calls may incur API charges. The prototype is unaudited.

## Tests and evidence

The repository suite has 150 tests: 29 contracts, 52 SDK, eight gateway, 20 CRE policy and 41 CLI/tooling. New policy tests cover stream decisions and bound observations; signed local-chain tests verify escrow, payer authentication, reuse without per-request transactions, cancellation and exact refund reconciliation.

Historical standalone price captures remain at [ALLOW](evidence/cre-allow.log) / [DENY](evidence/cre-deny-budget.log). Historical direct-transfer AI evidence in `evidence/agent-demo/` documents the earlier implementation and must not be presented as streaming/refund evidence. Fresh streaming runs write exact configs, original CLI transcripts, hashes, model response records, transaction journals and accounting under `.local/agent-demo/runs/`.

## Official references

- [CRE simulation](https://docs.chain.link/cre/guides/operations/simulating-workflows)
- [CRE SDK](https://github.com/smartcontractkit/cre-sdk-typescript)
- [Circle USDC deployments](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Circle test faucet](https://faucet.circle.com/)
- [Chainlink Price Feed Addresses](https://docs.chain.link/data-feeds/price-feeds/addresses)

This work does not submit a bounty entry or change repository visibility.
