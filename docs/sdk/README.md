# SDK reference

The repository provides two separate clients. Install with `npm --prefix sdk install` and build with `npm run build:sdk` from the repository root. No published npm package is assumed.

| Client | Use | Amount scale |
| --- | --- | --- |
| [GuardedPaymentClient](guarded-payment-client.md) | Settlement after authenticated CRE report acceptance | Raw bigint; Circle USDC uses 6 decimals |
| [AgentPaySDK](agentpay-sdk.md) | Legacy project-specific HTTP 402 stream negotiation | Raw bigint/human rates with 18-decimal tUSD |

`src/index.ts` exports both clients, `SpendingMonitor` and their types. Optional legacy AI/proxy modules exist in source; the frontend does not run them or provision model credentials.

Start with [guarded settlement](guarded-payment-client.md) for the CRE bounty flow. [Agent setup](../AGENT_SETUP.md) generates an integration template without a wallet or key. [Configuration](../getting-started/configuration.md) covers public frontend settings versus server-side keys.
