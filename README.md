# AgentPay

Agent payments with an orchestration layer built on **Chainlink Runtime Environment (CRE)**.

AgentPay combines a TypeScript agent SDK, token streaming contracts, an Express payment gateway, and a React dashboard. The project is being extended with a CRE Payment Guard that connects external market data to onchain authorization.

## Run the existing application

Use Node.js 22 and npm. Install all four packages with `npm run install:all`, then run `npm run dev`. Copy `.env.example` and configure your own Sepolia deployments before using wallet transactions. The frontend uses `vite-project/.env.local` for its `VITE_*` configuration.

- `npm run test:contracts`: local contract tests
- `npm run test:sdk`: SDK tests
- `npm run build:web`: frontend build
- `npm run deploy:sepolia`: deploy new AgentPayStream and MockUSD contracts (requires a funded testnet wallet)

The bundled MockUSD token uses 18 decimals, has an unrestricted test faucet, and is for demonstrations only. Chainlink CRE orchestrates workflows; it is not the payment asset. Configure the token and stream addresses explicitly. The renamed contracts require new deployments; old FlowPay addresses are not reused.

## Repository

- `contracts/`: AgentPayStream and test token
- `sdk/`: AgentPaySDK, payment decisions, spending controls, and proxy
- `server/`: payment middleware and example API
- `vite-project/`: React application
- `demo/`: provider/consumer examples
- `docs/`: architecture, setup, and references

[Migration history](MIGRATION.md) records the original snapshot and its 19 focused import commits. The `.kiro` directory and migration manifest retain historical source names as provenance.

This is an independent project integrating Chainlink technology.
