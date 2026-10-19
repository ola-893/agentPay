# AI agent and local CRE demo

This CLI runs a real Qwen or OpenAI tool-calling agent. It requests research from a loopback HTTP service, obtains a payment quote, invokes CRE locally against live Coinbase and Sepolia data, and enforces the result before signing a Circle test-USDC transfer. The service verifies the transfer receipt before returning its sample research note. The model then explains its actual tool results.

**Verified on 2026-10-19:** Qwen `qwen3.5-plus` completed both live tool journeys. Basic received local CRE ALLOW, transferred **0.01 Circle test USDC**, unlocked the receipt-verified sample resource, and increased the recipient balance by `10000` raw units. Premium received `AMOUNT_EXCEEDS_POLICY` with unchanged balances and nonce. [Original run transcript](evidence/agent-demo/run.log) · [Structured result](evidence/agent-demo/result.json) · [Independent RPC receipt and historical balances](evidence/agent-demo/rpc-verification.json) · [Sepolia transaction](https://sepolia.etherscan.io/tx/0x9e0e57611cd2bf0f4a85f45e313d03f03750129dc00f6f8db58f5ab2f81eb59b).

The initial OpenAI generation attempt returned HTTP 429 `credit_balance_exhausted`; OpenAI is covered by mocked protocol tests but its live generation/payment journey was not verified. The successful run explicitly selected Qwen; it was not an automatic fallback.

## Configure

Use Node 22+, installed root/CRE dependencies, Bun and the CRE CLI with a working login. Put secrets only in ignored root `.env`:

```dotenv
AGENTPAY_AI_PROVIDER=qwen
QWEN_API_KEY=<funded-Qwen-API-key>
QWEN_MODEL=qwen3.5-plus
QWEN_REGION=singapore
PRIVATE_KEY_1=<dedicated-Sepolia-test-wallet-key>
AGENTPAY_AGENT_RECIPIENT=<different-Sepolia-recipient-address>
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

Qwen defaults to the Singapore international endpoint. Use `virginia` or `beijing` for keys issued in those regions. For workspace-specific endpoints, set `QWEN_BASE_URL` to your official Model Studio URL ending `/compatible-mode/v1`. Only official HTTPS Model Studio hosts are accepted. See [Alibaba's Responses API documentation](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-responses).

For OpenAI instead, set `AGENTPAY_AI_PROVIDER=openai`, `OPENAI_API_KEY`, and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`). Without an explicit provider, a configured Qwen key selects Qwen; otherwise OpenAI is selected. Errors never trigger a provider or rules fallback.

Existing local settings named `OPEN_AI_KEY` and `CRE_PAYMENT_RECIPIENT_ADDRESS` are accepted as aliases. `PRIVATE_KEY` is a fallback for `PRIVATE_KEY_1`. Explicit primary values take precedence. Never use `VITE_` variables or browser fields for these keys. The selected model must support Responses API function calls. API calls require available credit and incur usage. Host-side argument validation applies regardless of the provider's schema enforcement.

For payment, fund the payer with at least 0.01 Circle test USDC and Sepolia ETH for gas. The recipient must differ from the payer and USDC contract. Circle's [test faucet](https://faucet.circle.com/) must have **Ethereum Sepolia** selected. No new contract or CRE network workflow deployment is required.

## Run

Preview uses the configured model API and CRE, but never signs, pays, or unlocks paid content:

```sh
npm run demo:agent
```

To execute a complete test purchase:

```sh
npm run demo:agent -- --pay
```

Each new `--pay` run can transfer **at most 0.01 test USDC**, plus Sepolia ETH for gas. It is not a read-only health check. Model usage is additionally billed by the selected model provider. For structured output, use `npm run --silent demo:agent -- --pay --json`. `--help` performs no environment loading, network or model calls.

## Expected journey

1. The host starts a loopback demo research service. No separately managed provider process is required.
2. The model returns actual `buy_research` tool calls. The demonstration task asks it to attempt both tiers. The model controls only the tier and a short purpose; it cannot set prices, recipients, token, chain, cap or transaction data.
3. Basic research returns an HTTP 402 quote for `10000` raw USDC units (0.01). Premium costs `200000` (0.2). The CRE cap is `100000` (0.1).
4. Each quote gets a distinct request ID and an isolated CRE config with the real parties, pinned Circle token/feed/API, zero receiver and `publishReport: false`. The runner verifies the complete CRE result, request tuple, policy and ABI body. Canonical staging captures are not replaced.
5. An ALLOW for basic can unlock the local wallet executor when `--pay` is present. The host checks chain, six-decimal token, exact quote/intent, balances, feed freshness, elapsed approval lifetime and a separate 0.01-USDC run limit before signing. It saves the signed transaction's hash before broadcasting, without saving the signed payload or private key.
6. After two confirmations, receipt verification requires success, exact sender/recipient/token/amount, exact transfer calldata and a matching USDC Transfer event. Balance snapshots must show an exact `10000` recipient increase and payer decrease. Only then does the service return its sample operational note.
7. Premium must return `DENY (AMOUNT_EXCEEDS_POLICY)` without signing. Balance and nonce snapshots must remain unchanged for that request. Any earlier price/freshness denial stops the expected demo; limits are never loosened to obtain success.
8. The model receives the actual tool outputs and generates a final explanation. The CLI separately prints the verified basic/premium status and recipient increase, so model prose is not payment evidence.

Repeated model calls for the same tier reuse the existing result. A run never retries an attempted payment automatically. If confirmation or later processing fails after submission, inspect that run's `payment.json` and its transaction hash before starting another paid run. A new invocation is a new purchase, not a resume command.

## Evidence and limits

Each invocation writes `.local/agent-demo/runs/<run-id>/` with:

- `events.jsonl`: Model response IDs, reported usage, visible tool arguments/results and model text; no keys or hidden reasoning.
- `cre-basic.*` / `cre-premium.*`: exact configs, original CLI transcripts and validated results, with config/transcript SHA-256 hashes.
- `basic.json`, `premium.json`: authoritative tool outcomes.
- `payment.json`: submission hash, confirmed receipt and before/after balances when payment occurs.
- `result.json`: completed journey and final model explanation; or `failure.json` when completion fails.

The service's note is explicitly labeled sample operational guidance. Its receipt protocol is `agentpay-demo-receipt-v1`, **not full x402** and not the separate legacy streaming gateway's hash header. Receipt age, exact transfer matching and per-quote reuse checks prevent an older/different payment from unlocking a new quote.

The trust boundary is local: **the wallet-owning process enforces the CRE result**. This is not a DON-authenticated report, onchain guard enforcement, or `AgentPaySettlement` payment. Existing strict contracts stay closed and unchanged. CRE observation timestamps and host capture timestamps are recorded separately; the local executor bounds elapsed approval age with a monotonic clock and consumes feed freshness headroom while it waits. It does not present simulation output as a signed onchain credential.

No fallback model, mock decision, fabricated receipt or heuristic is used in a live demo. Tests use explicitly synthetic model/CRE outputs and a disposable local ERC-20 fixture. Those passing tests prove local code paths; they do not prove a successful model call or Circle Sepolia transfer.

Model explanations are untrusted prose. The host prints authoritative status and integer balance changes separately, and supplies explicit six-decimal display values to reduce unit errors. Policy approval is not a compliance guarantee.

## Verification

[Commands, results and clean-source verification](evidence/agent-demo/VERIFICATION.md).

```sh
npm test
npm run docs:check
```

The new tests cover model/tool failures, duplicate calls, secret redaction, exact quote binding, denial/expiry/freshness/run limits, receipt matching and an actual signed local transfer with receipt-gated content and replay rejection. CLI success exits 0; operational failure exits 1; invalid arguments/configuration exits 2. The JSON envelope follows the existing CLI convention.

For OpenAI `credit_balance_exhausted`, fix API billing or save a funded key before rerunning. A successful model metadata lookup alone does not establish generation access. [Official OpenAI error guidance](https://developers.openai.com/api/docs/guides/error-codes).

[Qwen Responses API](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-responses) · [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) · [CRE workflow](WORKFLOW.md) · [USDC addresses and units](USDC_SEPOLIA.md)
