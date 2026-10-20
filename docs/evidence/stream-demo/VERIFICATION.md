# CRE stream lifecycle verification — October 20, 2026

Implementation checkpoint: `ada1463`. The captured run preceded minor recipient-validation and output-spacing hardening; current policy tests and evidence validation re-evaluate its recorded decisions.

This is a historical real Sepolia run, not reusable payment authority. CRE ran locally; no workflow was deployed to Chainlink's network.

| Stage | Evidence and result |
| --- | --- |
| USDC asset safety | `cre-price.*`: actual Coinbase HTTP request, finalized Chainlink feed/token reads, ALLOW |
| Stream admission | `stream-open.*`: real HTTP health snapshot and explicit-block Sepolia reads; OPEN |
| Escrow funding | `approval.json`, `open.json`, `basic.json`: confirmed 10000 raw USDC deposit, recipient unchanged upfront, stream #1 |
| First request batch | Five real requests reuse the signed payer session and same stream ID; wallet nonce 11 → 11 |
| Healthy checkpoint | `stream-healthy.*`: client/provider observations agree; matching onchain stream; CONTINUE |
| Second request batch | Five additional requests reuse stream #1; nonce 11 → 11 |
| Service fault | Explicitly injected provider outage; three real responses return HTTP 503; nonce unchanged |
| Outage checkpoint | `stream-outage.*`: actual failed-service snapshot and stream reads; CLOSE / SERVICE_UNAVAILABLE |
| Cancellation | `close.json`, `settlement.json`: inactive stream, 600 raw earned, 9400 raw refunded; sum 10000 |
| Premium denial | `stream-deny.*`, `premium.json`: 200000 deposit > 100000 cap; DENY with unchanged balances and nonce |
| Independent chain check | `rpc-verification.json`: re-fetched public receipts/calldata; historical escrow, payer and recipient balances corroborate funding and refund |
| Actual model | `events.jsonl`, `result.json`: real Qwen qwen3.5-plus response IDs, usage, visible tool calls/results and final explanation |

Circle test USDC uses six decimals: funded 0.01; earned 0.0006; refunded 0.0094. The original CLI progress transcript is `run.log`. Its labels were subsequently given more spacing; the original evidence was retained unchanged.

## Public transactions

- [USDC stream deployment](https://sepolia.etherscan.io/tx/0xbe04cb990b1a3ab1276f231acdfb27baccae54f3aab065530b97f4649cc4e2d3)
- [Exact token approval](https://sepolia.etherscan.io/tx/0x5e3c45d52bbf407161feeb0d093e2f6e674a36565f4534ede2cbc87a2ffc855b)
- [Stream creation](https://sepolia.etherscan.io/tx/0x81966282be0a35356f5b3de5835ce5c080270148a230c1116d3a251dea781746)
- [Stream cancellation, earnings and refund](https://sepolia.etherscan.io/tx/0x3d22cd3855b6bc10c4cf29e9496630ff698d3697c85ea9c2f2e2db8d78a432ca)

## Commands run

- `npm run deploy:usdc-stream -- --json`: exit 0; separately deployed AgentPayStream with Circle USDC, verified exact runtime and token binding. The tUSD stream instance was retained.
- `npm run demo:agent -- --json`: exit 0; real Qwen + CRE admission preview, zero funding/signing and unchanged wallet state.
- `npm run demo:agent -- --pay --json`: exit 0; actual stream lifecycle, request reuse, closure/refund and premium denial.
- `npm test`: exit 0; 150 passing tests: 29 contracts, 52 SDK, 8 gateway, 20 CRE policy, 41 tooling/CLI.
- `node --test scripts/test/stream-demo.test.mjs`: exit 0; real signed escrow/cancellation on a disposable local chain, payer-session authentication and forged-signature rejection, no per-request transactions, refund reconciliation, non-owner recovery rejection, invalid recovery flags, denied/substituted admission before provider access.
- `npm run docs:check`: exit 0; local links, exact SDK/UI snippets and historical evidence integrity/policy consistency.
- CRE typecheck, frontend lint and frontend build: exit 0. The existing over-500-kB frontend chunk warning remains.

Runtime: Node 22, Bun 1.3.12, CRE CLI 1.37.0. Production CLI resource limits remained enabled. An early workflow experiment failed because URL parsing is unavailable in the CRE WASM runtime; validation now uses a bounded loopback URL expression. No live data was replaced with fixtures to obtain success.

## Limits

The health provider and client run under one operator. Their matching counters are not independent service attestation; outages are intentionally injected. The service returns sample operational guidance. This is a project-specific HTTP 402/session protocol, not full x402.

CRE reads a frozen health snapshot over HTTP and actual onchain state at the specified recent block. The initial price feed read is finalized; stream transactions wait two confirmations and are not claimed finalized. The wallet owns transaction authority, not the local CRE result. No AgentPayGuard/AgentPaySettlement execution or DON authentication occurred.

Earnings accrue until cancellation is mined; the outage is not a basis for retroactive reimbursement. Closure itself settles accrued earnings; this public run did not add a separate recipient withdrawal. Tests verify withdrawal independently. No universal gas savings percentage is claimed, and model/RPC/compute costs are separate from transaction counts.

OpenAI live generation remains unverified because its configured key previously exhausted API credit; this run used Qwen. Synthetic model/CRE tests are distinguished from the genuine workflow transcripts and public-chain receipts above.
