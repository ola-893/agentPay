# CRE payment guard

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

Successful captures save `docs/evidence/cre-<scenario>.json` and `.log`, plus JSON in `vite-project/public/evidence`. Existing captures are backed up before successful replacement; failure leaves them intact. Frontend schema version **2** validates USDC identity and units. Capture time and CRE observation time are separate. Evidence contains config/log hashes and an ABI-encoded report body, not a reusable signed credential.

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

Rolling budgets, confidential execution, KYC, complete x402 transport and live public settlement are outside the demonstrated scope. The workflow owner/configuration are trusted. [Submission evidence](CRE_SUBMISSION.md).
