# Sepolia operator setup

The supported chain is Ethereum Sepolia (`11155111`). Use a dedicated test wallet, test ETH for gas, and ignored `.env`; never commit a key or use a `VITE_` variable for credentials. The project is unaudited and testnet tokens have no monetary value.

## Guard and settlement contract record

The [contract record](guarded-usdc.md) retains the connected public Sepolia guard and settlement addresses. These contracts remain closed with a zero workflow ID. The project uses local CRE simulation; workflow deployment to Chainlink's network and the public DON-authorized USDC payment test are outside scope. Neither deployment approval nor USDC funding is needed for read-only CLI simulation. [USDC addresses and units](../USDC_SEPOLIA.md).

## Legacy stream path

### Confirmed project deployment

The current contracts were deployed on Ethereum Sepolia on October 19, 2026:

| Contract | Address |
| --- | --- |
| AgentPayStream | [0xE047120881026327aF28E74a6EA0C046Edd01568](https://sepolia.etherscan.io/address/0xE047120881026327aF28E74a6EA0C046Edd01568) |
| MockUSD (tUSD, 18 decimals) | [0xE97847558DDEd18Fc6208cE47eeEc7ab73c09D9D](https://sepolia.etherscan.io/address/0xE97847558DDEd18Fc6208cE47eeEc7ab73c09D9D) |

The [public deployment record](sepolia-stream.json) includes successful creation receipts, block numbers, runtime code hashes and the source commit. Both onchain runtimes exactly matched the compiled artifacts; `paymentToken()` matched the deployed MockUSD address. `npm run --silent demo:check -- --json` passed against this deployment. The deployer received 1,000,000 test tUSD from the token constructor and retained 0.029648452 Sepolia ETH after deployment.

The local root `.env` and frontend `.env.local` are configured with these addresses. The CLI demo uses the dedicated deployment wallet as both payer and recipient for self-stream testing; set `PAYMENT_RECIPIENT_ADDRESS` to a separate wallet when testing recipient access. Local credentials remain ignored by Git. A fresh checkout must configure its own wallet and the public addresses below.

This establishes deployment and read-only setup checks. Explorer source verification, stream creation/withdrawal and browser-wallet transactions were not performed. It does not deploy a CRE guard, settlement contract, workflow or report receiver; the guarded Circle USDC path remains separate.

### Deploy your own contracts

1. Copy root `.env.example` to `.env`, set `SEPOLIA_RPC_URL` and dedicated `PRIVATE_KEY`.
2. Run `npm run deploy:sepolia` from the repository root. The script deploys MockUSD and AgentPayStream and prints their addresses.
3. Save those actual addresses to `vite-project/.env.local`:

```dotenv
VITE_CONTRACT_ADDRESS=<deployed-AgentPayStream>
VITE_PAYMENT_TOKEN_ADDRESS=<deployed-18-decimal-MockUSD>
```

4. Restart Vite, open Streams, connect on Sepolia and mint test tUSD if needed.
5. Test a small stream, recipient withdrawal and closure with your dedicated wallets. Document real deployment addresses/transactions before sharing claims.

For the legacy provider, set `AGENTPAY_STREAM_ADDRESS`, `PAYMENT_TOKEN_ADDRESS` and `PAYMENT_RECIPIENT_ADDRESS` in root `.env`. The TypeScript provider launched with `npm run demo:provider` reads those settings and listens on port 3005. [Middleware contract](../architecture/x402-protocol.md).

No live deployment, explorer verification or successful browser-wallet transaction is implied by these steps. Current saved evidence is [read-only CRE simulation](../CRE_SUBMISSION.md). For an isolated record-only write instead, use the distinct [mock-forwarder procedure](../RECORDING_READINESS.md).
