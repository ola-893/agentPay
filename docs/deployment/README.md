# Deployment overview

Use [the root deployment guide](../../DEPLOYMENT.md) as the operator entry point. AgentPay supports **Ethereum Sepolia only** in the documented configuration. No AgentPay consumer, settlement, stream or live DON deployment is claimed by the saved read-only evidence.

Choose deliberately:

| Action | Result |
| --- | --- |
| `npm run dev` | Local frontend with saved evidence; no deployment/wallet needed |
| `npm run cre:simulate` | Read-only live-input CLI workflow execution |
| `npm run deploy:guard` | Strict guard + settlement, needs test wallet and official forwarder |
| `npm run deploy:cre-demo` | Separate record-only simulation consumer; explicit opt-in and dedicated demo wallet |
| `npm run deploy:sepolia` | Legacy MockUSD + AgentPayStream; does not configure USDC settlement |

The deployment commands spend Sepolia test ETH. The write runner simulates without broadcast by default; `--broadcast` is explicit. [Recording and mock-write instructions](../RECORDING_READINESS.md).

[Sepolia setup](sepolia.md) · [USDC token/feed](../USDC_SEPOLIA.md) · [Contract reference](../contracts/README.md)
