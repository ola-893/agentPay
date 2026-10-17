# Configuration

All supported workflows here target **Ethereum Sepolia, chain ID 11155111**. The frontend does not consume `VITE_CHAIN_ID`, `VITE_TARGET_CHAIN_ID`, `VITE_RPC_URL` or feature flags from the old imported guides.

## Configuration locations

| File | Purpose |
| --- | --- |
| `cre/payment-guard/config.staging.json` | Guarded USDC payment intent, policy limits and report destination |
| `cre/project.yaml` | CRE simulator's Sepolia RPC; separate from root `.env` |
| `.env` (ignored) | Hardhat, server and operator credentials/settings |
| `vite-project/.env.local` (ignored) | Public legacy stream and 18-decimal token addresses |
| Browser storage | Agent setup draft only; does not configure any deployed workflow |

## CRE sample

| Field | Current meaning |
| --- | --- |
| `request.token` | Circle Sepolia USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| `tokenDecimals` | `6` |
| `priceFeedAddress` | Sepolia USDC/USD `0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E` |
| `marketApiUrl` | `https://api.coinbase.com/v2/prices/USDC-USD/spot` |
| `request.amount` / `spendingCap` | `10000` / `100000` raw USDC units |
| `maxDeviationBps` | `100`, relative disagreement limit |
| `maxPegDeviationBps` | `100`, limit for either source's deviation above/below $1 |
| `maxFeedAgeSeconds` | `86400`, sample bound matching the listed 24-hour heartbeat |
| `authorizationTtlSeconds` | `300` |
| `receiverAddress` / `publishReport` | Zero address / `false`, preview only |

The schema pins chain, asset, decimals, feed and API together. Real publication also needs real parties, a fresh request ID and a deployed receiver. [USDC rationale](../USDC_SEPOLIA.md) and [deployment](../../DEPLOYMENT.md).

## Root environment

Copy `.env.example` to ignored `.env` when deploying or running a server that needs it. Leave secrets blank for read-only/frontend use.

| Setting | Consumer |
| --- | --- |
| `SEPOLIA_RPC_URL` | Hardhat, server and optional write runner; not the CRE read runner's YAML RPC |
| `PRIVATE_KEY` | Optional dedicated testnet strict-consumer/stream deployer |
| `CRE_FORWARDER_ADDRESS`, `CRE_WORKFLOW_ID` | Strict guard deployment and workflow binding |
| `ALLOW_SIMULATION_DEMO`, `DEMO_PRIVATE_KEY` | Explicit, isolated mock-forwarder demo deployment/broadcast |
| `AGENTPAY_STREAM_ADDRESS`, `PAYMENT_TOKEN_ADDRESS`, `PAYMENT_RECIPIENT_ADDRESS`, `PORT` | Legacy provider/server |
| `GEMINI_API_KEY` | Optional legacy SDK model access; not needed for CRE or frontend |
| `CRE_BIN` | Override simulator CLI executable path |

The legacy `demo/consumer.ts` additionally reads `PRIVATE_KEY_1`. It can mint and create streams; run it only deliberately with a funded dedicated test wallet and configured legacy provider. Do not use it as a read-only health check.

## Frontend legacy stream settings

```dotenv
VITE_CONTRACT_ADDRESS=<deployed-AgentPayStream-address>
VITE_PAYMENT_TOKEN_ADDRESS=<deployed-18-decimal-MockUSD-address>
```

Restart Vite after changes. Both addresses must be nonzero valid EVM addresses. This enables stream setup, not guarded settlement. Never place a private key in a `VITE_` variable: frontend environment values are public.

## SDK configuration

The guarded client takes `{ guardAddress, settlementAddress, chainId }` and a connected ethers signer; `pay` takes a raw bigint amount. [Guarded reference](../sdk/guarded-payment-client.md).

The legacy `AgentPaySDK` constructor takes `{ privateKey, rpcUrl, apiKey?, agentId?, spendingLimits? }`. Its spending limits are bigint `dailyLimit` and `totalLimit`; there are no constructor `contractAddress`, `tokenAddress`, `defaultStreamDuration`, `autoApproveTokens`, `maxRetries` or `retryDelay` options. Contract/token addresses are supplied to `createStream` or obtained from provider requirements. [Actual streaming SDK API](../sdk/agentpay-sdk.md).
