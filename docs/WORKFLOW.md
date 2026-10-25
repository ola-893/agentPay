# Deterministic CRE guardrails for agent payment streams

AI agents already reason about work and services. Payment authority needs a separate control layer: hallucinated instructions can waste funds by proposing unnecessary funding, continuing an unavailable service, or requesting an inappropriate lifecycle change. CRE evaluates explicit rules over validated observations; the CLI follows checked results in its managed session flow instead of treating model text as authorization.

Given the same configuration and observations, the policy returns the same result. Deterministic evaluation does not make external data infallible: freshness, session binding, client/provider counter agreement, budget and rate bounds are part of the guardrail. These controls reduce avoidable loss rather than guarantee loss-free execution.

AgentPay began with the N+1 payment problem: a naive paid API integration can require a blockchain transaction for every request. Prepaid escrow lets many authenticated requests share one time-based stream. That reduces per-request payment transactions, but does not decide whether the service deserves continued payment. A funded stream keeps accruing during an outage until a cancellation is mined.

Local Chainlink CRE workflows add deterministic service and spend guardrails to that payment model. They combine HTTP observations with Sepolia state and return deterministic policy results. The wallet-owning CLI validates those results and gates signing; the stream contract enforces escrow, accrual and payouts, not CRE approval. The workflow is simulated locally and is not deployed to a Chainlink DON.

## From cheap request reuse to controlled spending

1. **Before opening:** the price workflow compares Coinbase and finalized Chainlink USDC/USD data. The [stream supervisor](../cre/payment-guard/stream-main.ts) reads provider health over HTTP, compares client counters, and checks token identity, decimals, wallet balance and proposal bounds at an explicit Sepolia block. An eligible proposal receives `OPEN`; the over-budget example receives `DENY`.
2. **Before wallet actions:** the [spend review](SPEND_AUDIT.md) dry-runs the exact approval, creation or cancellation call, reads Circle token state and applies hard rules plus a transparent risk heuristic. ALLOW, BLOCK and ERROR records go to durable local blobs. Before signing, a spend approval needs an onchain inclusion receipt, an unexpired intent and a fresh successful simulation. Remaining decisions, including blocks, are anchored in batches.
3. **While the stream is reused:** requests authenticate to the provider using the payer's signed session and onchain stream state. At a healthy checkpoint, CRE combines HTTP counters with the existing stream and returns `CONTINUE`. No per-request token transaction is needed.
4. **When the observed service fails:** the demo injects three HTTP 503 responses. CRE evaluates the checkpoint and returns `CLOSE / SERVICE_UNAVAILABLE`. The CLI reviews and signs cancellation; the contract pays accrued earnings and refunds unused escrow. The runner verifies the event, state, balance changes and rejection of access after closure.

Admission lasts 120 seconds. If setup confirmations outlive it, the CLI obtains new price and stream decisions before signing; it does not extend the old decision's lifetime or retry an uncertain deposit. The [October 22 live run](evidence/admission-fix/VERIFICATION.md) used one stream for ten successful requests, then paid 0.00072 USDC and refunded 0.00928 USDC. Three new audit receipts committed seven decisions, including premium denial. Payouts vary with elapsed time.

Checkpoints are explicit CLI steps, not an always-running monitor. Local service observations and RPC simulation are trusted inputs, not independent service-quality attestations. Health checks do not score answer usefulness. Risk scores are heuristic, and receipts prove inclusion of operator-submitted hashes. Accrual continues through detection, review and mining latency. Approval, stream lifecycle and audit transactions still consume gas; this prototype does not claim fixed net savings or full x402 compatibility.

Run preview or the funded journey using the [AI CLI guide](AI_AGENT_DEMO.md). The [Workflow dashboard](WORKFLOW_DASHBOARD.md) diagrams this lifecycle and replays actual captured runs. In local development it can launch the same CLI through a loopback server and display its events; the CLI performs the model, CRE, supervision and signing work.

## Standalone USDC price-safety workflow

The remaining reference describes the standalone USDC price/report workflow used as the initial asset-safety gate in the streaming demo. Its ALLOW/DENY captures are the recorded evidence displayed on the frontend.

The [TypeScript workflow](../cre/payment-guard/main.ts) orchestrates an external API, finalized Ethereum Sepolia reads, deterministic policy and report generation. The checked-in configuration demonstrates the bounty's simulation path; it is not a deployed DON workflow.

## Inputs and decisions

1. A cron trigger (`0 */5 * * * *`) starts the sample intent. CLI simulation selects trigger index 0 explicitly.
2. CRE HTTPClient fetches Coinbase USDC/USD and uses median aggregation.
3. EVMClient reads the Chainlink USDC/USD description, decimals and latest round plus Circle USDC's decimals at finalized blocks.
4. The policy checks completed/valid rounds, timestamps, freshness, source disagreement, the $1 peg and a raw-unit per-request cap.
5. CRE generates the destination-bound report.

[Verified token/feed addresses and policy limits](USDC_SEPOLIA.md) are pinned together in schema validation. Token amounts use 6 decimals; price observations use 8.

| Scenario | Requested raw USDC | Cap | Expected decision with healthy prices/feed |
| --- | --- | --- | --- |
| ALLOW | `10000` (0.01 USDC) | `100000` (0.1) | `WITHIN_POLICY` |
| Budget DENY | `200000` (0.2) | `100000` (0.1) | `AMOUNT_EXCEEDS_POLICY` |

## Run and capture

From the repository root, after installing Bun and the authenticated CRE CLI:

```sh
npm run install:cre
cre login
npm run cre:dry-run
npm run cre:simulate
npm run cre:simulate -- --deny-budget
npm run cre:capture
npm run cre:capture -- --deny-budget
```

The wrapper creates ignored configs in `.local/cre`. DENY changes the amount only; a live input can cause an earlier policy denial and the wrapper will fail instead of mislabeling it as the expected scenario. The dry run requires more than 600 seconds of feed freshness headroom by default. [Recording options and backups](RECORDING_READINESS.md).

Read-only simulation uses `cre/project.yaml` for its RPC. Root `.env`'s `SEPOLIA_RPC_URL` is separate. Connectivity to CRE services, Coinbase and Sepolia is required; no wallet key or funds are needed by the read-only runner.

Successful captures save `docs/evidence/cre-<scenario>.json` and `.log`, plus JSON in `vite-project/public/evidence`. Existing captures are backed up before replacement. CLI or expected-decision failure leaves them intact. The three output files are written sequentially: interruption during file writing can leave mixed copies. Restore the retained backup and run `npm run docs:check` before using such evidence. Frontend schema version **2** validates USDC identity and units. Capture time and CRE observation time are separate. Evidence contains config/log hashes and an ABI-encoded report body, not a reusable signed credential.

## Denial reasons

| Reason | Meaning |
| --- | --- |
| `INVALID_FEED` | Nonpositive price, wrong price decimals, invalid/incomplete round or timestamp |
| `FUTURE_FEED` | Feed timestamp exceeds runtime by more than 60 seconds |
| `FEED_STALE` | Feed age exceeds 86400 seconds |
| `INVALID_MARKET_QUOTE` | Nonpositive evaluated quote; malformed/wrong-asset API payload instead fails execution |
| `PRICE_DEVIATION` | Source disagreement exceeds 100 basis points relative to Chainlink |
| `USDC_DEPEG` | Either price is more than 100 basis points above/below $1, even if both agree |
| `AMOUNT_EXCEEDS_POLICY` | Requested raw token units exceed the per-request cap |

The listed 24-hour heartbeat and sample max age are a testnet demonstration setting, not an immediate-depeg-detection guarantee. The live saved DENY is a budget rejection. Depeg/boundary cases are deterministic [policy tests](../cre/payment-guard/policy.test.ts), not claims of a real depeg.

## Authorization boundary

The report body is ABI encoded in this order:

```text
uint256 chainId, address receiver, bytes32 requestId,
address agent, address recipient, address token,
uint256 maxAmount, uint64 validUntil, bool approved
```

The report amount comes from `request.amount`, not `spendingCap`: the sample ALLOW report authorizes at most `10000` raw units (0.01 USDC), even though the policy cap is `100000` (0.1 USDC). A single positive settlement up to that bound is permitted and consumes the whole request, including any unused headroom.

The sample agent and recipient are placeholders, receiver is zero and `publishReport` is false. Authorization lifetime is 300 seconds. Publication by a real workflow must reach the strict consumer through its trusted forwarder with the owner-bound workflow identity. A fresh request needs a unique request ID; duplicate reports/consumption fail. [Strict consumer](contracts/guarded-settlement.md) and [deployment steps](../DEPLOYMENT.md).

`reportWriteSucceeded` can reflect a simulated write. It is not proof of public publication. The isolated mock receiver cannot settle payments; its optional runner claims publication only after independently verifying a successful receipt and matching event. [Optional write demo](RECORDING_READINESS.md).

Rolling budgets, confidential execution, KYC, complete x402 transport and live DON-authenticated strict settlement are outside the demonstrated scope. The workflow owner/configuration are trusted. [Submission evidence](CRE_SUBMISSION.md).
