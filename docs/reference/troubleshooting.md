# Troubleshooting

## Frontend and setup

| Symptom | Action |
| --- | --- |
| Evidence unavailable / missing / unreadable | Restore both `vite-project/public/evidence/cre-*.json` captures or rerun `cre:capture` for each scenario, then Retry. The viewer validates current USDC schema/scale. |
| Loading times out | Check the local/static server and network, then Retry. Do not replace an error with a fabricated result. |
| Streams shows setup guidance | Set valid nonzero `VITE_CONTRACT_ADDRESS` and `VITE_PAYMENT_TOKEN_ADDRESS` in `vite-project/.env.local`, then restart Vite. Use 18-decimal MockUSD here. |
| Browser wallet not detected | Open the app in a wallet-enabled browser. Workflow evidence, Docs and Agent setup require no wallet. |
| Connection request already pending | Open your wallet and finish or reject its existing request. |
| Request cancelled | Reconnect/retry only when ready; rejection is not a successful transaction. |
| Account/network changed | Reconnect on Ethereum Sepolia to refresh the active app session. |
| Balance unavailable / refresh failed | Check RPC, deployment addresses, token decimals and `stream.paymentToken()` binding. An RPC failure is not a zero balance or empty success. |
| Streams missing older records | UI discovery covers the latest 49000 blocks. Use a known stream ID to check/withdraw from an older stream. |
| Draft not restored | Browser storage may be blocked or cleared. Save again or copy the SDK example without persistence. |
| Nested route fails on hosting | Preserve the included SPA fallback so `/docs/cre` and other routes load `index.html`. |

## CRE

| Error or reason | Action |
| --- | --- |
| Authentication failure | Verify `cre login`, organization/account setup and service connectivity. Do not paste credentials into docs or browser fields. |
| Network/RPC/API error | Check CRE services, Coinbase endpoint and the RPC in `cre/project.yaml`. Root `.env`'s RPC does not override read simulation YAML. |
| `FEED_STALE` / recording `FEED_NEAR_EXPIRY` | Wait for the feed to update and rerun the dry run. Its default recording window is 600 seconds. |
| `PRICE_DEVIATION` / `USDC_DEPEG` | Inspect both quotes; do not relax thresholds to capture a passing result. |
| `AMOUNT_EXCEEDS_POLICY` | Raw units exceed cap. Expected for budget DENY, not ALLOW. `0.01 USDC = 10000`. |
| Feed pair/decimals mismatch | Verify pinned Sepolia USDC token/feed/API as one configuration. Do not substitute an ETH/USD feed or 18-decimal token. |
| Write runner rejects manifest/key | Follow the isolated demo deployment procedure; no public receipt is claimed until verified. |

### Coinbase request times out before connecting

On October 19, 2026, both CLI scenarios compiled but failed with `Get "https://api.coinbase.com/v2/prices/USDC-USD/spot": context deadline exceeded`. The cause was the local hotspot's DNS resolver: it resolved Sepolia but timed out on Coinbase. This was not a policy rejection or proof that Coinbase was down.

Compare name resolution with a normal HTTPS request:

```sh
nslookup api.coinbase.com
nslookup api.coinbase.com 1.1.1.1
curl --max-time 12 https://api.coinbase.com/v2/prices/USDC-USD/spot
```

If the network resolver fails while a public resolver succeeds, configure a working DNS resolver for your connection. On the affected Mac, changing **Wi-Fi DNS** to `1.1.1.1` and `8.8.8.8` restored normal Coinbase HTTPS requests and both CRE scenarios. This changes DNS for all apps using that service; it is a machine setting, not a repository setting. The previous setting was automatic DNS. Restore it on that Mac with:

```sh
networksetup -setdnsservers Wi-Fi empty
```

Then rerun `npm run cre:dry-run`. The [before/after evidence](../evidence/network-dns-fix/verification.json) records both initial execution failures and successful ALLOW/DENY runs after the DNS change. Workflow source, endpoint, TLS verification, HTTP deadline and policy limits were unchanged. No API addresses were pinned and no price data was substituted. This result does not guarantee availability on another network or at a later time.

## AI CLI demo

`npm run demo:agent -- --help` describes its prerequisites without loading credentials. Configure the key only in root `.env`; see the [AI agent guide](../AI_AGENT_DEMO.md).

| Failure | Action |
| --- | --- |
| Qwen 401 or model access error | Match `QWEN_REGION` / optional official `QWEN_BASE_URL` to the key's issuing region and workspace; check model access and billing. |
| OpenAI `credit_balance_exhausted` | Add API credits or use a funded key. ChatGPT access and a successful model metadata lookup do not establish API generation credit. |
| CRE denied basic | Inspect the original transcript, live prices and feed age. Do not loosen policy to force an approval. |
| Payment confirmation uncertain | Inspect the transaction hash in this run's `payment.json` before another paid run. The CLI never automatically retries; a new `--pay` invocation can spend another 0.01 test USDC. |
| Strict SDK says unauthorized | The AI CLI uses a separate local wallet gate. Its simulation cannot authorize the closed public strict guard. |

Provider failures do not trigger a rules-based agent or automatic provider fallback. Model summaries are untrusted prose; use the host-verified status, raw units and receipt as evidence.

## SDK TypeScript dependency identity

If `Signer`/`Network` types report incompatible private fields, the app and SDK are resolving different copies of ethers. Align or deduplicate the integrating project’s ethers dependency, and construct the signer from the same dependency instance as the SDK. Place the documented fragments in `sdk/`, import `./src` and construct the signer with `ethers` imported there. The guarded reference shows `Wallet`/`JsonRpcProvider` construction with caller-supplied test credentials; verification only compiles it and does not create, fund or use a wallet.

## Settlement and streams

A missing/denied/expired/consumed guard authorization must be replaced by a fresh authenticated report for the exact signer, recipient, token, amount and destination, using an unused request ID. The sample authorization lifetime is 300 seconds. [Guarded client](../sdk/guarded-payment-client.md).

For stream withdrawal, use the recipient wallet, a positive whole-number stream ID and an onchain claimable amount above zero. Reaching the stop time does not set `isActive` false; ended active streams can still pay their unwithdrawn remainder. A closed stream cannot be withdrawn again.

The legacy gateway deliberately rejects `X-AgentPay-Tx-Hash`. It does not recognize arbitrary transaction hashes or automatically map guarded settlement receipts to API access. [Provider protocol](../architecture/x402-protocol.md).

The prototype is unaudited. [UI verification limits](../UI_UX_REVIEW.md) distinguish tested responsive/data behavior from unexecuted live browser-wallet transactions. [FAQ](faq.md).
