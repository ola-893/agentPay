# Frequently asked questions

## What does AgentPay currently demonstrate?

An AI agent funds a USDC escrow stream, reuses it for service requests, and uses local CRE HTTP/onchain checkpoints to continue or close it with earned-payment/refund verification. A secondary price gate compares Coinbase and finalized Chainlink USDC/USD. The browser shows separate historical price evidence. [Submission](../CRE_SUBMISSION.md).

## Is a wallet required?

Not to view evidence, read Docs or prepare an Agent setup draft. Read-only authenticated CRE CLI simulation also needs no wallet key/funds. Deployment, report broadcast or token settlement require a deliberately configured dedicated Sepolia wallet.

## Which token and decimals?

AI streaming CLI and guarded reference: Circle Sepolia USDC, **6 decimals** (`0.01 = 10000`). Legacy streams: MockUSD/tUSD, **18 decimals**. Both are valueless testnet tokens. The retained browser stream UI and legacy AgentPaySDK still require tUSD. [USDC policy](../USDC_SEPOLIA.md).

## Why USDC/USD, and can two matching depegged prices pass?

The price check follows the payment asset. Each source must be within 1% of $1 and within 1% disagreement relative to Chainlink. Two matching $0.98 quotes are denied. The sample max age matches the listed 24-hour heartbeat; it does not promise immediate detection.

## Does saved ALLOW authorize payment?

No. Saved captures are historical evidence, never spend credentials. The streaming CLI uses fresh local CRE decisions as wallet-side policy; the wallet signs escrow funding or cancellation. The separate strict settlement reference requires an authenticated report accepted by its onchain guard and is not used by the streaming CLI. [Guarded client](../sdk/guarded-payment-client.md).

## Does Agent setup run or pause an agent?

No. It validates a non-secret local draft, stores it in this browser and generates SDK code. Saving does not change contract state or CRE limits. [Agent setup](../AGENT_SETUP.md).

## Is the project deployed or audited?

A USDC-configured AgentPayStream is deployed on Sepolia, and the AI demo has verified real funding, request reuse, cancellation, earned payout and unused-funds refund. CRE stays local; no workflow is deployed to a DON. This is an unaudited prototype. [Deployment](../../DEPLOYMENT.md) and [AI guide](../AI_AGENT_DEMO.md).

## Does this implement x402?

The legacy gateway/SDK use AgentPay-specific HTTP 402 headers and streaming heuristics. They do not implement the full current transport/facilitator protocol. The gateway rejects direct hash-only proof and does not automatically grant API access for guarded settlement receipts. [Actual protocol](../architecture/x402-protocol.md).

## What happens when a stream ends?

At stop time the recipient can claim the entire unwithdrawn remainder, including rounding dust. `isActive` remains true until cancellation/closure; the gateway separately denies service after stop time. Either party may close an active stream to pay accrued funds/refund unspent funds. [Streams](../architecture/payment-streams.md).

## Are there global daily limits or emergency controls?

CRE has a per-request cap. The legacy SDK's spend monitor and pause are instance-local/in-memory. The frontend does not provide live emergency controls, model telemetry or onchain rolling budgets.

## Where should I debug an error?

Use [troubleshooting](troubleshooting.md). Live market inputs can change the expected CLI outcome; do not weaken thresholds to capture ALLOW. Missing frontend contract configuration is resolved through setup, not by repeatedly connecting a wallet.
