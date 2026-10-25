# AgentPay manual demo: deterministic payment guardrails

**Core message:** the agent proposes work, CRE checks fixed payment rules, and the CLI executes eligible actions. The agent already supplies the intelligence. CRE supplies deterministic guardrails around the payment commitment.

## Prepare

Use Node 22, installed dependencies, Bun and an authenticated CRE CLI. Configure the model, dedicated payer, recipient, USDC stream and audit journal using the [AI CLI guide](../docs/AI_AGENT_DEMO.md) and [spend-review guide](../docs/SPEND_AUDIT.md). The paid run needs Circle Sepolia USDC and Sepolia ETH for stream and audit transactions.

```sh
npm run --silent demo:agent -- --help
npm run --silent demo:agent
```

Dry-run before presenting: live price, feed freshness or service inputs can change a policy result. Preview makes real model and local CRE calls, saves decision blobs and signs no transaction. Use the Workflow page's recorded run if external inputs prevent a live demonstration.

For the visual dashboard in another terminal:

```sh
npm run dev:live
```

Open `http://127.0.0.1:5317/`. Use **Recorded** for the existing funded replay. Local Preview is available without enabling browser payment controls. Do not start a second paid run in the browser while presenting the terminal run.

## Present the problem and the guardrail

“An agent making a thousand paid API requests should not need a thousand payment transactions. AgentPay funds one escrow stream and reuses that session across many requests. Earnings accrue with time, without a payment transaction for each call.

“But efficient payments still need controls. A hallucinated payment instruction could create unnecessary funding or keep paying an unavailable service. We separate the agent's reasoning from payment authority. Chainlink CRE connects external service and price observations with blockchain state, then evaluates explicit rules. The CLI validates those results before signing.”

Point to the diagram's external-input chips, CRE policy node, **fund once** edge and request-reuse loop. Explain that CRE is run through the local simulator in this demo.

## Run the funded lifecycle

```sh
npm run --silent demo:agent -- --pay
```

This creates a new stream with at most **0.01 USDC** escrow. Approval, funding, cancellation and audit receipts use Sepolia gas. Do not promise exact payout amounts or a fixed runtime; both depend on live execution.

| Terminal evidence | What to explain |
| --- | --- |
| Real model tool request | “The agent proposes a service tier and purpose. It cannot rewrite the quote, recipient, deposit or policy.” |
| Price observations and `OPEN` | “CRE reads HTTP observations and Sepolia state. Fixed price, health, budget, rate and identity checks admit this proposal.” |
| Spend review and receipt | “The exact transaction is dry-run and checked, its decision is stored in a durable blob, and a receipt anchors its hash before the CLI signs.” |
| Ten successful requests and `CONTINUE` | “The CLI and provider reuse the validated session. CRE checks the existing stream at a healthy checkpoint; requests do not each fund another payment.” |
| Three injected HTTP 503 failures and `CLOSE` | “The observed failure threshold triggers the configured rule. The CLI cancels; this is a policy result rather than model judgment.” |
| Earned/refunded totals and transaction link | “The contract pays time-accrued earnings and refunds unused escrow. These totals reconcile to the original deposit.” |
| Premium request and `DENY` | “The proposed 0.2 USDC exceeds the 0.1-USDC cap. The CLI refuses funding regardless of the agent's request.” |

The requested stream earns **10 raw USDC/s** (0.00001 USDC/s); the configured maximum is **100 raw/s** (0.0001 USDC/s). USDC has six decimals: the basic deposit is `10000` raw. The cap is a per-proposal bound, not a guarantee about aggregate wallet spending.

## Close with the contribution

“One funded session reduces payment transactions. Deterministic CRE guardrails reduce avoidable loss from unchecked agent payment instructions. We can inspect the observations, rules, decisions and resulting transactions.”

Keep enforcement precise: the wallet-owning CLI applies local CRE results; AgentPayStream enforces escrow and payouts. The workflow is not deployed to a DON. Health checks run at explicit checkpoints; they do not prove answer quality or undo already-earned time. Explicit operator recovery can still close an owned stream. This is a Sepolia prototype using test tokens.

For legacy model-assisted tUSD integration, use the [AgentPaySDK reference](../docs/sdk/agentpay-sdk.md); it is separate from this CRE-guarded USDC demo.
