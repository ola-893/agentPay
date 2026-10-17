# Circle USDC on Ethereum Sepolia

The CRE guarded path uses **Circle’s Sepolia USDC**, not MockUSD. The legacy stream UI and streaming SDK remain a separate 18-decimal tUSD demo. Do not configure USDC as `VITE_PAYMENT_TOKEN_ADDRESS` or use it with the legacy stream SDK. The frontend stream creation path checks token decimals before approval.

## Verified deployments

Verified against the official sources on **17 October 2026**:

| Item | Sepolia configuration |
| --- | --- |
| Network | Ethereum Sepolia, chain ID `11155111` |
| Circle USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Token decimals | `6` |
| Chainlink USDC/USD proxy | `0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E` |
| Feed decimals | `8` |
| Coinbase endpoint | `https://api.coinbase.com/v2/prices/USDC-USD/spot` |
| Feed’s listed heartbeat / deviation threshold | `86400` seconds / `1%` |

Circle lists the token in its [USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses). Obtain test USDC by selecting **Ethereum Sepolia** and USDC in the [Circle faucet](https://faucet.circle.com/). Read-only workflow simulation does not need tokens or a wallet key.

The [Chainlink Price Feed Addresses page](https://docs.chain.link/data-feeds/price-feeds/addresses) includes the feed under **Ethereum → Sepolia Testnet** (`ethereum-sepolia`). It links the [Sepolia reference directory](https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia.json). A [source metadata snapshot](evidence/usdc-source-verification.json) records the entry and source hash. The workflow independently reads the feed description (`USDC / USD`), feed decimals and Circle token decimals at finalized blocks; it fails on a mismatched pair or token scale. Schema validation pins the chain, token, decimals, feed and API together.

Sepolia USDC has **no financial value and is not backed by real dollars**, as Circle’s documentation states. The USD references model a stablecoin payment policy; they do not assign value or redemption rights to testnet USDC.

## Exact payment units

| Scenario | Human amount | Raw amount | Raw cap |
| --- | --- | --- | --- |
| ALLOW | 0.01 USDC | `10000` | `100000` (0.1 USDC) |
| Budget DENY | 0.2 USDC | `200000` | `100000` |

The policy cap is an admission limit, not the report maximum. An approved report encodes `request.amount` as `maxAmount`: the ALLOW example permits one payment of at most 0.01 USDC, not 0.1 USDC. The workflow, report, guard and `GuardedPaymentClient` use raw integer units. The dashboard formats them with six decimals using integer/string arithmetic, preserving values above JavaScript’s safe integer range. Price values separately use eight decimals: `$1 = 100000000`. The report ABI is unchanged; evidence schema version 2 identifies the USDC policy and token scale.

```ts
// After the production guard accepts an authenticated, unexpired report:
await client.pay(requestId, recipient,
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 10000n);
```

## Policy and limitations

1. Reject invalid/incomplete rounds, future timestamps and feeds older than `86400` seconds.
2. Reject Coinbase versus Chainlink disagreement greater than `100` basis points (1%), measured against the Chainlink price.
3. Reject either source more than `100` basis points above **or below $1** (`USDC_DEPEG`). Two agreeing prices at $0.98 are still denied. Boundaries are inclusive and use integer arithmetic.
4. Reject an amount above the per-request raw-unit cap.

The sample max age matches the feed’s published 24-hour heartbeat. It is a deliberate testnet demonstration setting, not a promise of immediate depeg detection or suitable production risk controls. A stricter maximum age will intentionally halt payments between feed updates; review data cadence and risk requirements before any deployment. No threshold is changed by the capture runners to obtain ALLOW.

The workflow is an orchestration policy for agent payments. The existing gateway uses project-specific HTTP 402 headers; this change does **not** implement the current x402 transport or facilitator protocol. USDC is confined to guarded settlement. The optional mock-forwarder write receiver remains record-only, cannot settle tokens and does not authenticate workflow identity. The strict consumer retains its identity checks. This remains an unaudited prototype.

## Reproduce evidence

```sh
npm run cre:dry-run -- --save-evidence
npm run cre:capture
npm run cre:capture -- --deny-budget
```

The two CLI scenarios use live Coinbase and finalized Sepolia reads. Only successful expected outcomes replace captures; older ETH/USD evidence is retained under `docs/evidence/backups/` as the previous policy’s history. Depeg and boundary outcomes are tested deterministically in `cre/payment-guard/policy.test.ts`; the recorded live DENY scenario is an over-budget denial, not a claim of a real USDC depeg.
