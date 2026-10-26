# CRE bounty submission: AgentPay

**Core contribution:** reusable streams reduce per-request payment transactions; deterministic CRE guardrails reduce avoidable spending caused by unchecked model-generated payment actions. The AI proposes service requests, CRE evaluates explicit price/health/session/budget/rate rules, and the CLI applies the checked outcome. CRE is the policy boundary around the agent’s financial commitments.

AgentPay addresses the transaction-per-request payment problem with prepaid escrow streams. An AI agent funds one stream, makes many service requests without additional payment transactions, and cancels when finished or when service fails. The provider earns tokens with time; unused escrow returns to the sender on cancellation.

CRE provides deterministic guardrails for that lifecycle. The workflow combines HTTP service observations with Ethereum Sepolia stream state and returns `OPEN`, `CONTINUE`, `CLOSE` or `DENY`. An initial CRE price workflow also compares live Coinbase USDC/USD with a finalized Chainlink USDC/USD feed. The agent wallet executes stream actions. This submission uses local CRE simulation, not a workflow deployed to Chainlink's network.

## Visual workflow and execution dashboard

Open Workflow (`/`) to see how CRE combines price, service and chain observations around an agent’s escrow stream. The dashboard runs the **same CLI** through a local loopback server or replays actual event-emitter captures on the hosted static build. The event timeline displays original inputs, decision/reason, host checks, commands and transcript links. Wallet and audit cards have actual Sepolia explorer links. “Registered locally” means a profile file, not an onchain registry.

```sh
npm run dev:live
```

Configure CLI prerequisites first and authenticate CRE; choose Live local and Preview. The Tiny cap preset exercises a genuine over-budget DENY. Pay requires explicit server opt-in and user confirmation with the fixed 0.01 test-USDC cap. Recorded mode carries its capture date, creates no transactions and never calls a hosted visitor’s localhost. [Dashboard guide](WORKFLOW_DASHBOARD.md) · [Event schema](EVENT_SCHEMA.md) · [Actual captured event index](../vite-project/public/runs/index.json).

## Requirement mapping

| Requirement | Implementation |
| --- | --- |
| CRE orchestration inside the project | [Stream supervisor](../cre/payment-guard/stream-main.ts): HTTP observations + EVM reads → bounded lifecycle decision |
| At least one blockchain | Ethereum Sepolia; actual Circle USDC and AgentPayGuardedStream state |
| External API/system | HTTP provider-health snapshots outside the workflow; initial public Coinbase USDC/USD API plus Chainlink feed checks |
| Successful simulation or deployment | Real CLI simulations for admission, healthy continuation, outage closure and premium denial; no CRE network deployment required |
| Workflow used by the application | [AI CLI](../demo/agent-demo.mjs) consumes each decision and signs stream operations; API requests reuse its authenticated stream session |

## Demonstrate the guarded payment model

Follow the [AI streaming demo guide](AI_AGENT_DEMO.md) for credentials, public stream address and exact commands. Preview performs admission checks only. The funded demo:

1. A real Qwen/OpenAI model requests both research tiers.
2. CRE checks USDC price safety and basic stream admission.
3. The policy process signs OPEN; the CLI audits the exact transaction; the guarded contract verifies the permit as the wallet deposits `10000` raw USDC (0.01) into AgentPayGuardedStream over 1000 seconds, earning `10` raw units per second.
4. Five API calls reuse that stream without a new payment transaction.
5. CRE fetches provider observations, corroborates client counters, reads the matching stream at an explicit Sepolia block and returns `CONTINUE`.
6. Five more requests reuse the same stream.
7. The demonstration explicitly injects a provider outage; three real requests return labeled HTTP 503 responses.
8. CRE returns `CLOSE`; the separate policy process signs CLOSE and the guarded contract verifies it as the wallet cancels the stream. Contract events and balance snapshots establish time-accrued payment and unused-deposit refund.
9. Premium admission requests a `200000` deposit (0.2) against a `100000` cap (0.1) and is denied without signing.

The [USDC stream deployment record](deployment/guarded-usdc-stream.json) verifies the public contract runtime, token binding and deployment receipt. [Circle USDC units and feed rationale](USDC_SEPOLIA.md).

The CLI reports actual approval/open/close transactions separately. Reused API calls and CRE read-only checkpoints do not create payment transactions. No fixed dollar gas price or universal 98% savings is claimed; token approval and any recipient withdrawals must be counted when comparing costs.

## Verified guarded stream run — current path

On October 25, guarded stream #1 served ten requests, returned CONTINUE, then
closed on the injected outage. The contract consumed separately signed OPEN/CLOSE
nonces 0 and 1. Cancellation paid **0.00132 USDC** and refunded **0.00868 USDC**.
[Original events and all CRE transcripts](../vite-project/public/runs/20261025T173241Z-38db9e1a/events.ndjson) ·
[Signature, receipt and balance verification](evidence/guarded-stream/VERIFICATION.md).
Unsigned and agent-forged approvals were independently checked to revert.

A later retest failed CRE authentication after five requests; operator recovery
closed stream #2. [Failure and public recovery evidence](evidence/guarded-retest/VERIFICATION.md).
That failed retest is not presented as a successful lifecycle or current CRE availability.
The video uses the complete guarded run, with its capture date.

## Earlier unguarded Sepolia stream run

On October 20, 2026, Qwen and the local CRE CLI completed all four lifecycle decisions. Stream #1 escrowed 0.01 USDC, served ten successful requests with no per-request payment transactions, and closed after three explicitly injected HTTP 503 failures. Cancellation paid 0.0006 USDC in accrued earnings and refunded 0.0094 USDC. Approval, creation and cancellation were three actual transactions; no fixed gas-saving percentage is inferred.

[Original transcript](evidence/stream-demo/run.log) · [Result/model records](evidence/stream-demo/result.json) · [RPC receipts and historical balances](evidence/stream-demo/rpc-verification.json) · [Verification methods and limits](evidence/stream-demo/VERIFICATION.md).

[Stream creation](https://sepolia.etherscan.io/tx/0x81966282be0a35356f5b3de5835ce5c080270148a230c1116d3a251dea781746) · [Cancellation and refund](https://sepolia.etherscan.io/tx/0x3d22cd3855b6bc10c4cf29e9496630ff698d3697c85ea9c2f2e2db8d78a432ca).

## Inspect the CRE work

The [price workflow](../cre/payment-guard/main.ts) uses CRE `HTTPClient` for Coinbase and `EVMClient.callContract` for finalized feed/token reads. The [stream workflow](../cre/payment-guard/stream-main.ts) uses `HTTPClient` for frozen service-health snapshots and `EVMClient.callContract` for token, wallet and stream reads at the configured block. Its [policy](../cre/payment-guard/stream-policy.ts) combines those observations into lifecycle decisions. The CLI invokes both through `cre workflow simulate`; it parses the results, binds them to the exact configuration and re-evaluates policy before using them. The local workflows return results; a separate policy process signs eligible OPEN/CLOSE approvals and AgentPayGuardedStream verifies them when the agent submits the transaction. Neither signature is a DON report.

These are original captures from the October 20 funded run, not fresh executions or reusable authorization:

| Check | CRE-observed inputs and outcome | Original transcript | Exact config and result |
| --- | --- | --- | --- |
| USDC price safety | Chainlink $0.99990138, Coinbase $1; feed age 69,050s against 86,400s maximum; `ALLOW / WITHIN_POLICY` | [Price log](evidence/stream-demo/cre-price.log) | [Price config/result](evidence/stream-demo/cre-price.json) |
| Admission | Block 11956794; provider available, 0 successes/0 failures; deposit 10000 raw against cap 100000; `OPEN / HEALTHY_WITHIN_BUDGET` | [OPEN log](evidence/stream-demo/stream-open.log) | [OPEN config/result](evidence/stream-demo/stream-open.json) |
| Healthy checkpoint | Block 11956799; provider/client report 5 successes/0 failures; active stream #1, 120 raw claimable; `CONTINUE / SERVICE_HEALTHY` | [CONTINUE log](evidence/stream-demo/stream-healthy.log) | [CONTINUE config/result](evidence/stream-demo/stream-healthy.json) |
| Injected outage | Same read block 11956799; provider unavailable, 10 successes/3 failures; `CLOSE / SERVICE_UNAVAILABLE` | [CLOSE log](evidence/stream-demo/stream-outage.log) | [CLOSE config/result](evidence/stream-demo/stream-outage.json) |
| Premium admission | Block 11956803; deposit 200000 raw exceeds cap 100000; `DENY / AMOUNT_EXCEEDS_POLICY` | [DENY log](evidence/stream-demo/stream-deny.log) | [DENY config/result](evidence/stream-demo/stream-deny.json) |

The transcript shows workflow compilation, binary/config hashes, trigger execution and the serialized result. Current CLI output also displays the exact invocation, input observations, limits and transcript path by default; `--verbose` adds saved-file hashes. A policy can stop at its first rejecting condition: premium is denied for budget before health, while outage rejection does not establish that every later stream-binding check passed. The wallet separately verifies the intended stream before cancellation. Displayed claimable amounts belong to the read block; the cancellation transaction determines the actual payout.

Run a fresh admission preview with `npm run --silent demo:agent`. Only `--pay` funds a new stream and reaches funded checkpoints. The loopback health URL in a saved config belongs to that historical process, so rerunning that file alone is not a supported replay; the CLI creates a new service/session and configuration for each live run.

## Trust and verification limits

- The CLI applies its audit gates; AgentPayGuardedStream verifies a separate local policy signature for OPEN/CLOSE and enforces escrow accounting. The contract does not prove CRE execution or external observation truth. Legacy AgentPayStream recordings demonstrate CLI-only checks. The escrow gate does not constrain unrelated EOA transfers. Strict AgentPayGuard/Settlement remain separate and unused.
- Service counters come from a co-located demo provider and client. Comparing them detects discrepancies but is not independent proof of service quality. The outage is injected, not a claimed real incident.
- Earnings accrue until cancellation is mined; outage detection cannot reverse already-earned amounts. Cancellation pays accrued earnings and refunds unused escrow in one contract transaction.
- Stream/wallet reads use an explicit recent block. The host waits two confirmations for writes; those writes are not claimed finalized. The separate Chainlink price-feed read is finalized.
- The provider requires a signed payer session bound to origin, quote and stream, along with onchain state checks. This is an AgentPay HTTP 402 protocol, not full x402.
- The frontend distinguishes Recorded replay from Live local execution. Hosted mode never accesses a visitor’s localhost. Live events originate in the same CLI through a loopback-only server; no browser wallet or secret field is used. Recorded events cannot authorize a new payment.
- Circle test USDC has no monetary value. Model calls may incur API charges. The prototype is unaudited.

## Tests and evidence

The repository suite covers contracts, SDK, gateway, CRE policy and CLI/tooling; use current test output for counts. New policy tests cover stream decisions and bound observations; signed local-chain tests verify escrow, payer authentication, reuse without per-request transactions, cancellation and exact refund reconciliation.

Historical standalone price captures remain at [ALLOW](evidence/cre-allow.log) / [DENY](evidence/cre-deny-budget.log). Historical direct-transfer AI evidence in `evidence/agent-demo/` documents the earlier implementation and must not be presented as streaming/refund evidence. Fresh streaming runs write exact configs, original CLI transcripts, hashes, model response records, transaction journals and accounting under `.local/agent-demo/runs/`.

## ToolBuyer: buying information about service quality

The [ToolBuyer workflow](../cre/payment-guard/toolbuyer-main.ts) adds a separate local simulation: real HTTP trial answers plus Circle USDC budget reads feed task-specific Beta quality estimates and a one-step expected-information-value stopping rule. Held-out comparisons count all trial and service costs against cheapest, fixed-showcase and fixed-expert baselines. Costs are benchmark credits; this feature does not perform token transfers or claim contract-enforced provider selection.

[Original CRE trial logs and comparison](TOOLBUYER.md) show the successful simulations and the limitation: ToolBuyer outperforms cheapest/showcase on this controlled fixture but loses to always buying the strong provider. The providers are synthetic and the local grader is trusted; these results are not independent proof of commercial service quality.

## Spend audit and batched decision receipts

The [spend-review workflow](../cre/payment-guard/spend-main.ts) combines actual RPC dry-runs with Circle USDC chain reads, applies hard-rule and risk-score gates, and posts every returned decision to a durable local blob service. The agent CLI requires an onchain inclusion receipt before business signing. [Nine recorded decisions and two public receipt batches](SPEND_AUDIT.md) include ALLOW and BLOCK results, including the live stale-feed rejection. ERROR and the full audited stream lifecycle are tested separately on a local RPC. The receipt contract attests operator-submitted hashes, not DON identity, risk correctness or complete wallet coverage.

## Official references

- [CRE simulation](https://docs.chain.link/cre/guides/operations/simulating-workflows)
- [CRE SDK](https://github.com/smartcontractkit/cre-sdk-typescript)
- [Circle USDC deployments](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Circle test faucet](https://faucet.circle.com/)
- [Chainlink Price Feed Addresses](https://docs.chain.link/data-feeds/price-feeds/addresses)

This work does not submit a bounty entry or change repository visibility.
