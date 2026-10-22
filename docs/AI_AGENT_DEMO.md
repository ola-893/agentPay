# AI agent with CRE-supervised payment streams

AgentPay keeps its original payment model: a sender funds an escrow stream, the recipient earns tokens with time, and many API requests reuse that stream. The AI CLI now uses **AgentPayStream**, rather than sending a token transfer for every purchase.

A local CRE workflow combines real HTTP service observations with Sepolia wallet and stream reads to return `OPEN`, `CONTINUE`, `CLOSE` or `DENY`. The CLI validates those results before the sender's wallet signs stream transactions. **AgentPayStream enforces escrow accounting, time accrual, withdrawal permissions and cancellation payouts; it does not verify CRE results.** A payer can call the contract directly without this CLI or a CRE approval. CRE is not deployed to Chainlink's network, and simulation output is not DON-authenticated authority.

**Verified October 20, 2026:** real Qwen calls and local CRE executions opened Sepolia stream #1, reused it for ten successful requests, continued on healthy observations, and closed after three injected failures. A 0.01-USDC deposit produced **0.0006 USDC earned + 0.0094 USDC refunded**. [Original transcript](evidence/stream-demo/run.log) · [Structured result](evidence/stream-demo/result.json) · [Independent RPC verification](evidence/stream-demo/rpc-verification.json) · [Verification record](evidence/stream-demo/VERIFICATION.md).

## Configure

Use Node 22+, root dependencies, Bun, installed CRE dependencies and a working CRE login. Put settings only in ignored root `.env`:

```dotenv
QWEN_API_KEY=<funded-key>
AGENTPAY_AI_PROVIDER=qwen
QWEN_MODEL=qwen3.5-plus
QWEN_REGION=singapore
PRIVATE_KEY_1=<dedicated-Sepolia-test-wallet-key>
AGENTPAY_AGENT_RECIPIENT=<different-recipient-address>
AGENTPAY_USDC_STREAM_ADDRESS=0x5199d1dcaB9496d37677DAD8F53481DCc511d585
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

The [verified USDC stream deployment](deployment/usdc-stream.json) points at Circle's six-decimal Ethereum Sepolia USDC. The existing tUSD stream deployment cannot be substituted: its token was fixed in its constructor. The CLI verifies the audited stream runtime and Circle token binding before use. The legacy AgentPaySDK still uses 18-decimal tUSD. Stream management is no longer a frontend route; Workflow shows this USDC journey through the [local/recorded dashboard](WORKFLOW_DASHBOARD.md).

For OpenAI, set `AGENTPAY_AI_PROVIDER=openai`, `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`). `OPEN_AI_KEY` is an alias. Qwen defaults to Singapore; `QWEN_REGION` also accepts `virginia` and `beijing`. Optional `QWEN_BASE_URL` must be an official Model Studio HTTPS endpoint ending `/compatible-mode/v1`. Without an explicit provider, a Qwen key selects Qwen, otherwise OpenAI. No provider or heuristic fallback occurs.

`PRIVATE_KEY` is a fallback for `PRIVATE_KEY_1`; `CRE_PAYMENT_RECIPIENT_ADDRESS` is an alias for the recipient. Explicit primary values take precedence. Never use browser fields or `VITE_` variables for secrets. Model calls may incur API charges. Fund the sender with test USDC and Sepolia ETH; [Circle's faucet](https://faucet.circle.com/) provides test USDC. Testnet tokens have no monetary value.

## Preview

```sh
npm run --silent demo:agent
```

Preview now persists its CRE decisions in the [durable local audit journal](SPEND_AUDIT.md), leaving receipt writes pending. It makes real model, CRE, HTTP and blockchain calls. It evaluates basic admission (`OPEN`) and premium admission (`DENY`) but does not approve tokens, create a stream, unlock paid content or fabricate a funded checkpoint.

## Fund and supervise a stream

```sh
npm run --silent demo:agent -- --pay
```

Each invocation can deposit **at most 0.01 test USDC**, plus test ETH for approval/open/close **and audit-receipt gas**. Actual signing now requires a working local blob journal and the [verified decision-receipt contract](SPEND_AUDIT.md). Every business transaction is simulated, risk-reviewed, persisted and anchored before signing; denials are retained and receipts are counted separately. This is a new stream, not a read-only check or a resumed purchase.

Admission remains valid for 120 seconds. If approval or audit confirmations outlast that window (or the price approval expires), the CLI reruns both CRE price and admission checks before signing the next transaction. It saves each renewed decision and transcript separately. A failed or denied renewal stops signing; the CLI does not extend the old decision's lifetime or repeat a submitted deposit. The exact spend review must still be anchored, unexpired and freshly simulated before signing.

1. Qwen/OpenAI requests basic and premium sessions through real tool calls. The model chooses only a tier and purpose; it cannot change deposit, duration, rate, recipients or policy.
2. The loopback provider returns HTTP 402 with a bound streaming quote. Basic deposits `10000` raw USDC over **1000 seconds**, earning `10` raw units per second. Premium proposes `200000` against the CRE deposit cap `100000` and is denied. The wallet independently limits this demo to `10000`.
3. Before basic funding, the existing CRE price workflow checks live Coinbase and finalized Chainlink USDC/USD observations, peg bounds and freshness. These checks remain a secondary asset-safety gate.
4. The stream supervisor fetches a frozen health snapshot over real HTTP and reads the stream's token, token decimals and wallet balance at an explicit Sepolia block. A healthy, bounded proposal returns `OPEN`.
5. The wallet approves the exact deposit if allowance is insufficient, then calls `createStream()`. Two confirmations, the StreamCreated event, exact parties/rate/duration/metadata and balances must establish that funds entered escrow without paying the recipient upfront.
6. The agent signs a session authorization binding the provider origin, chain, quote, contract, stream ID and payer. The provider checks this signature and onchain stream state before serving content. A public stream ID alone is insufficient.
7. Five real service requests reuse the stream. A real CRE checkpoint compares the provider's HTTP counters with client-observed successes/failures and reads the matching onchain stream, returning `CONTINUE`. Five more requests reuse the same ID. Wallet nonce snapshots establish no payment transactions during either batch.
8. The demo explicitly injects a provider outage. Three real requests return labeled HTTP 503 responses. CRE reads that snapshot and stream state and returns `CLOSE / SERVICE_UNAVAILABLE`.
9. The sender wallet calls `cancelStream()`. The contract pays accrued, unwithdrawn earnings to the recipient and refunds the unearned amount to the sender. The runner verifies the cancellation event, inactive state, both balance deltas and `earned + refunded = deposit`. Access using the closed stream must fail.
10. The model receives the actual results and summarizes them. The host separately prints funded, earned and refunded amounts as authoritative facts.

The 1000-second window allows time for CLI compilation and confirmations. It is not a charge for 1000 requests. Earnings are time-based and continue until cancellation is mined; the workflow cannot retroactively refund already-earned time. This demo uses cancellation's built-in accrued payout, not a separate recipient withdrawal transaction. The contract also supports recipient withdrawals independently.

## Output and evidence

The terminal shows the exact CRE CLI command and working directory, configuration and original transcript paths, then observations from the validated result. Price checks show both USDC/USD prices, feed age and freshness limit, peg/disagreement limits and raw-unit budget. Stream checks show the HTTP endpoint, provider/client counters, failure threshold, Sepolia read block, token binding, wallet balance, deposit/rate limits and any existing stream's active/claimable state. Decisions are followed by the host validation status and an explicit statement that CRE made no onchain write. These are observations at the displayed block/time, not a claim of current health or balance.

The CLI then groups request batches and the escrow/earnings/refund summary. Supported terminals receive colour; redirected output and `NO_COLOR` use plain text. Use `--verbose` for model response IDs, configuration/transcript SHA-256 hashes and unverified model prose. `--json` preserves one result envelope on stdout and progress on stderr. Hashes bind saved files for drift checks; they do not authenticate a local result as a DON report.

For the full recorded `OPEN` → `CONTINUE` → `CLOSE` sequence and premium `DENY`, inspect the [original workflow transcripts and exact observations](CRE_SUBMISSION.md#inspect-the-cre-work). A new preview cannot reproduce funded checkpoints without creating a stream; use the historical evidence to review them without another deposit.

[Current CLI output capture](evidence/stream-demo/preview-output.log): a fresh Qwen + CRE preview completed October 20, 2026 (`20261020T181607Z-5247c337`), with price `ALLOW`, admission `OPEN` and premium `DENY`. JSON stdout remained one successful envelope; initial/final wallet snapshots matched and funded/earned/refunded amounts were all zero. The linked output is historical, not a new payment or funded checkpoint test; its `.local/` paths identify artifacts on the capturing machine. Presentation and invocation regression checks pass with the 42 CLI/tooling tests; docs checks, frontend lint and build also pass. No contract was changed or redeployed for this output update.

The result data schema is now **version 2**: modes `local-agent-stream` / `local-stream-preview`, with `fundedRaw`, `earnedRaw`, `refundedRaw` and basic status `stream-completed`. This is an intentional change from the older direct-payment result (`paidRaw`, `purchased`). The outer CLI envelope and existing flags remain compatible.

Every run writes `.local/agent-demo/runs/<id>/`:

- Original CRE price and supervisor transcripts, exact configurations, validated results and SHA-256 hashes.
- `approval.json`, `open.json`, `close.json`: transaction hash journaled **before broadcast**, then confirmed receipt metadata. No signed payload or private key is saved.
- `settlement.json`: the stream cancellation's earned/refunded amounts; this filename does not mean AgentPaySettlement was used.
- `basic.json`, `premium.json`, model `events.jsonl`, and completed `result.json` or `failure.json`.

Repeated model requests for a tier reuse its result. Funding is never automatically retried after uncertainty. If a funded run fails, the host attempts one safety cancellation when it knows the stream ID and has not already attempted closure. A failed cancellation is reported with recovery instructions. The fixed stream expiry still bounds accrual; it does not automatically execute a refund.

## Recover an interrupted stream

Inspect `open.json` / `close.json` and their public transaction hashes before repeating any transaction. If the stream remains active and owned by this payer:

```sh
npm run --silent demo:agent -- --close-stream 1
```

Replace `1` with the actual stream ID. Recovery needs the wallet, stream address, RPC, CRE, local audit storage and receipt contract; it makes no model call and cannot open another stream. It now performs the cancellation spend review and anchors its receipt before signing. Already-closed and other-payer streams are rejected. If creation confirmation was uncertain, inspect the open transaction's StreamCreated event to determine the ID first.

## Verification and limits

```sh
npm test
npm run docs:check
npm run typecheck:cre
```

Policy tests cover all four decisions, party/amount/rate/duration/metadata binding, wrong assets, balance limits, counter disagreement and malformed configuration. Signed local-chain tests cover real escrow funding, authenticated API reuse, no per-request transactions, injected outages, cancellation/refund reconciliation and denied funding before signing.

The provider is a local demo service serving labeled sample guidance. The outage is injected intentionally. Its counters and the client run under one operator; agreement is not independent proof of service quality. HTTP 402/session headers are an AgentPay demo protocol, **not full x402**. Session signatures bind access to a payer but do not add onchain CRE enforcement.

Stream/wallet reads use an explicit recent block; funding/closure wait two confirmations, not finality. The existing price feed read remains finalized. Local CRE is single-node execution, and wallet credentials remain under the operator's control. Closed strict guard/settlement contracts are unused by this path.

Historical direct-transfer evidence remains under `evidence/agent-demo/`, documenting the earlier implementation. It is not evidence of stream creation or refund. [CRE source](../cre/payment-guard/stream-main.ts) · [Stream contract](../contracts/AgentPayStream.sol) · [USDC addresses](USDC_SEPOLIA.md) · [CRE simulation](https://docs.chain.link/cre/guides/operations/simulating-workflows) · [Qwen Responses API](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-responses)
