# Sepolia operator setup

The supported chain is Ethereum Sepolia (`11155111`). Use a dedicated test wallet, test ETH for gas, and ignored `.env`; never commit a key or use a `VITE_` variable for credentials. The project is unaudited and testnet tokens have no monetary value.

## Current guarded USDC escrow

Use **AgentPayGuardedStream** at [0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09](https://sepolia.etherscan.io/address/0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09) for current paid agent runs. Set `AGENTPAY_USDC_STREAM_ADDRESS=0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09` in ignored root `.env`. The [deployment record](guarded-usdc-stream.json) verifies Circle USDC, runtime and distinct agent/policy/recovery authorities. [Setup and recovery](../GUARDED_STREAMS.md).

## Guard and settlement contract record

The [contract record](guarded-usdc.md) retains the connected public Sepolia guard and settlement addresses. These contracts remain closed with a zero workflow ID. The project uses local CRE simulation; workflow deployment to Chainlink's network and the public DON-authorized USDC payment test are outside scope. Neither deployment approval nor USDC funding is needed for read-only CLI simulation. [USDC addresses and units](../USDC_SEPOLIA.md).

The AI streaming CLI now has the [guarded Circle USDC deployment](guarded-usdc-stream.json). Its [guide](../AI_AGENT_DEMO.md) documents real escrow, reuse and refund verification. The records below retain the original tUSD/browser and strict-contract contexts.

## Legacy stream path

### Confirmed project deployment

The legacy tUSD contracts were deployed on Ethereum Sepolia on October 19, 2026:

| Contract | Address |
| --- | --- |
| AgentPayStream | [0xE047120881026327aF28E74a6EA0C046Edd01568](https://sepolia.etherscan.io/address/0xE047120881026327aF28E74a6EA0C046Edd01568) |
| MockUSD (tUSD, 18 decimals) | [0xE97847558DDEd18Fc6208cE47eeEc7ab73c09D9D](https://sepolia.etherscan.io/address/0xE97847558DDEd18Fc6208cE47eeEc7ab73c09D9D) |

The [public deployment record](sepolia-stream.json) includes successful creation receipts, block numbers, runtime code hashes and the source commit. Both onchain runtimes exactly matched the compiled artifacts; `paymentToken()` matched the deployed MockUSD address. `npm run --silent demo:check -- --json` passed against this deployment. The deployer received 1,000,000 test tUSD from the token constructor and retained 0.029648452 Sepolia ETH after deployment.

At that earlier verification the local legacy settings used these addresses. Current `demo:agent` uses a different guarded USDC escrow with distinct payer and recipient; for legacy self-stream testing only, set `PAYMENT_RECIPIENT_ADDRESS` to a separate wallet when testing recipient access. Local credentials remain ignored by Git. A fresh checkout must configure its own wallet and the public addresses below.

This establishes deployment and read-only setup checks. Explorer source verification, stream creation/withdrawal and browser-wallet transactions were not performed. It does not deploy a CRE guard, settlement contract, workflow or report receiver; the guarded Circle USDC path remains separate.

### Deploy your own contracts

1. Copy root `.env.example` to `.env`, set `SEPOLIA_RPC_URL` and dedicated `PRIVATE_KEY`.
2. Run `npm run deploy:sepolia` from the repository root. The script deploys MockUSD and AgentPayStream and prints their addresses.
3. Save those actual addresses to the legacy provider settings in root `.env`:

```dotenv
AGENTPAY_STREAM_ADDRESS=<deployed-AgentPayStream>
PAYMENT_TOKEN_ADDRESS=<deployed-18-decimal-MockUSD>
```

4. Configure `PAYMENT_RECIPIENT_ADDRESS` and use the legacy SDK/provider guide. The frontend no longer has a Streams route.
5. Test a small stream, recipient withdrawal and closure with your dedicated wallets. Document real deployment addresses/transactions before sharing claims.

For the legacy provider, set `AGENTPAY_STREAM_ADDRESS`, `PAYMENT_TOKEN_ADDRESS` and `PAYMENT_RECIPIENT_ADDRESS` in root `.env`. The TypeScript provider launched with `npm run demo:provider` reads those settings and listens on port 3005. [Middleware contract](../architecture/x402-protocol.md).

No live deployment, explorer verification or successful browser-wallet transaction is implied by these steps. Current evidence also includes the [signed guarded stream lifecycle](../evidence/guarded-stream/VERIFICATION.md). For an isolated record-only write instead, use the distinct [mock-forwarder procedure](../RECORDING_READINESS.md).
