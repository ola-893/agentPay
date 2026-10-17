# AgentPay frontend

React 19, Vite 7 and Tailwind. The current app presents a Chainlink CRE USDC workflow, a browser-local agent integration draft, and separate legacy tUSD stream management on **Ethereum Sepolia (11155111)**.

## Run

From the repository root:

```sh
npm --prefix vite-project install
npm run dev
```

Open the URL Vite prints; the port may vary. The evidence dashboard and Agent setup work without a wallet, contract deployment or credentials.

| Route | Behavior |
| --- | --- |
| `/` | Recorded USDC ALLOW/DENY evidence; `/cre` redirects here |
| `/agent` | Validated local draft, save/reset, exact-USDC SDK code generation |
| `/streams` | Setup guidance until legacy deployments and connected wallet are configured |
| `/docs` and `/docs/:section` | Eight current help topics with repository guides |
| `/dashboard` | Legacy stream counts for a connected wallet, no fabricated analytics |

Shared navigation, keyboard focus, safe-area padding, responsive layouts and evidence recovery are covered by the [UI review](../docs/UI_UX_REVIEW.md). Documentation content is in `src/lib/documentation.mjs`, rendered by `src/pages/Docs.jsx`.

## Configuration

Only legacy wallet streams need these public settings in `vite-project/.env.local`:

```dotenv
VITE_CONTRACT_ADDRESS=<new-AgentPayStream-address>
VITE_PAYMENT_TOKEN_ADDRESS=<new-18-decimal-MockUSD-address>
```

Restart Vite after changes. The chain is fixed to Sepolia. Old examples using `VITE_TARGET_CHAIN_ID=2810` are obsolete; those network overrides are not supported. No private key or service secret belongs in a `VITE_` variable.

Circle USDC has six decimals and belongs only to the guarded path. Legacy UI/SDK streams use 18-decimal tUSD. [Deployment](../DEPLOYMENT.md).

## Evidence and drafts

JSON is served from `public/evidence`. With authenticated CRE and Bun installed, refresh from the repository root:

```sh
npm run cre:capture
npm run cre:capture -- --deny-budget
```

The browser does not fetch live oracle prices or turn captures into payment authority. Agent setup uses local storage key `agentpay:guarded-agent-draft:v1` for non-secret configuration only; saving does not deploy/start an agent or modify CRE/onchain policy.

## Build and verify

```sh
npm --prefix vite-project run lint
npm run build:web
npm --prefix vite-project run preview
```

Deploy `vite-project/dist` as a static SPA. Preserve the included `_redirects`/hosting fallback so nested app routes resolve to `index.html`. Tailwind and PostCSS configs are CJS. [Repository docs](../docs/README.md).
