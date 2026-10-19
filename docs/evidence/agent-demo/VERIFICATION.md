# AI purchasing demo verification — 2026-10-19

Implementation commit: `671820a`. Public evidence is historical; it is not reusable payment authority.

| Behavior | Original evidence |
| --- | --- |
| Actual Qwen function calls and final explanation | `events.jsonl`, `result.json`, `run.log`; model `qwen3.5-plus`, three real response IDs |
| Basic 0.01 USDC allowed against 0.1 cap | `cre-basic.config.json`, `cre-basic.log`, `cre-basic.json`; real CRE compilation, Coinbase API and finalized Sepolia feed read |
| Exact wallet payment and content unlocked | `basic.json`, `payment.json`; two confirmations, matching transfer calldata/event, 40.00 → 39.99 payer and 0 → 0.01 recipient |
| Independent public-chain corroboration | `rpc-verification.json`; re-fetched transaction/receipt and recipient balances at blocks 11948798 and 11948799 |
| Premium 0.2 USDC denied against 0.1 cap | `cre-premium.*`, `premium.json`; `AMOUNT_EXCEEDS_POLICY`, nonce 6 → 6, balances unchanged |
| Secrets absent from publishable files | Changed/untracked files scanned against configured credential values; values were not printed |

Runtime: Node `v22.23.2`, Bun `1.3.12`, CRE CLI `v1.37.0`.

## Commands actually run

- `npm run demo:agent` — exit 0; real Qwen + both CRE scenarios, recipient increase 0, no signed payment. The earlier preview exposed model prose with incorrect unit conversions; explicit six-decimal display fields and instructions were added before the paid run.
- `npm run demo:agent -- --pay` — exit 0; real Qwen, basic purchased, premium denied, recipient increase `10000` raw units. Full output: `run.log`.
- `node --test scripts/test/agent-demo.test.mjs` — 13 passed, 0 failed. Covers model errors/arguments/duplicates, Qwen endpoint selection, secret stripping, CRE config path resolution, units and quote binding, denial/expiry/freshness/run cap, receipt matching, actual signed local transfer, resource unlocking and replay rejection.
- `npm test` — exit 0; 137 passed: 29 contracts, 52 SDK, 8 gateway, 11 CRE policy, 37 tooling.
- `npm run docs:check` — exit 0; 34 guides/8 frontend topics, 10 exact TypeScript fragments, original CRE and AI evidence consistency.
- `npm run typecheck:cre`, `npx tsc --noEmit --project demo/tsconfig.json`, `npm --prefix vite-project run lint` — exit 0.
- `npm run build:web` — exit 0; existing warning for a minified chunk over 500 kB remains.

A clean extraction of committed source `671820a` under `/private/tmp/agentpay-clean-q9y8_mrj` contained no `.env`, `.local`, artifacts or compiler cache initially. Installed dependency directories were reused through symlinks; this was not a fresh dependency installation. From it, `npm test` passed all 137 tests and `npm run --silent demo:agent -- --help --json` exited 0 with one JSON envelope. No live model/payment run was attempted from the credential-free copy.

## Limits

The selected Qwen key worked against the Singapore international endpoint. OpenAI generation returned HTTP 429 `credit_balance_exhausted` and was not demonstrated successfully. Synthetic model and CRE test fixtures are not live execution evidence. CI runs local fixtures without model/CRE credentials.

The wallet process enforces local CRE output. There is no DON deployment, authenticated onchain guard approval or AgentPaySettlement payment. The sample research service and its HTTP 402 receipt protocol are demo components, not full x402 or a production service. No contract was redeployed. The browser Agent setup page remains a local SDK draft. These tokens have no monetary value; a new paid invocation can spend another 0.01 test USDC and test ETH gas.

[Public transaction](https://sepolia.etherscan.io/tx/0x9e0e57611cd2bf0f4a85f45e313d03f03750129dc00f6f8db58f5ab2f81eb59b)
