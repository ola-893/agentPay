# Sepolia operator setup

The supported chain is Ethereum Sepolia (`11155111`). Use a dedicated test wallet, test ETH for gas, and ignored `.env`; never commit a key or use a `VITE_` variable for credentials. The project is unaudited and testnet tokens have no monetary value.

## Strict USDC consumer path

Follow [root deployment instructions](../../DEPLOYMENT.md) to deploy `AgentPayGuard`/`AgentPaySettlement`, configure the production forwarder, bind the deployed CRE workflow identity and set real report parties/receiver/unique request ID. The guard stays closed while workflow ID is zero. Circle USDC is already deployed; this command does not mint/deploy it. Obtain test USDC from the Circle faucet. [Verified addresses](../USDC_SEPOLIA.md).

Deployment access is separate from successful CLI simulation. The simulator's mock forwarder does not supply strict production identity metadata; the strict guard intentionally rejects it.

## Legacy stream path

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
