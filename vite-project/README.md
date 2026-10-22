# AgentPay frontend

React 19, Vite 7 and Tailwind. The frontend has two destinations: **Workflow** and **Docs**. Workflow explains how prepaid escrow addresses the N+1 payment problem and how local Chainlink CRE supervises the CLI, then displays recorded USDC price-policy evidence. Docs covers the workflow, CLI demo, policy and SDK reference.

The frontend is read-only. It has no wallet connection, agent console, draft editor, stream management or dashboard. Payment execution remains in the separate CLI on Ethereum Sepolia.

## Run

From the repository root:

```sh
npm --prefix vite-project install
npm run dev
```

Open the URL Vite prints. No wallet, credentials, deployment or frontend environment variables are needed.

| Route | Behavior |
| --- | --- |
| `/` | Workflow explanation and recorded USDC price-policy ALLOW/DENY evidence |
| `/cre` | Redirects to `/` |
| `/docs` and `/docs/:section` | Seven help topics, including the terminal-based CLI demo |

Former agent, stream and dashboard URLs show the normal not-found page. Both desktop and mobile navigation contain only Workflow and Docs. Documentation content is in `src/lib/documentation.mjs`, rendered by `src/pages/Docs.jsx`.

## Recorded evidence

JSON is served from `public/evidence`. With authenticated CRE and Bun installed, refresh from the repository root:

```sh
npm run cre:capture
npm run cre:capture -- --deny-budget
```

The browser does not fetch live oracle prices, run an agent or turn captures into payment authority. Circle USDC has six decimals in the separate streaming CLI. See the [CLI guide](../docs/AI_AGENT_DEMO.md) for execution and the [workflow guide](../docs/WORKFLOW.md) for authority boundaries.

## Build and verify

```sh
npm --prefix vite-project run lint
npm run build:web
npm run docs:check
```

Deploy `vite-project/dist` as a static SPA. Preserve the included hosting fallback so nested documentation routes resolve to `index.html`. [Repository docs](../docs/README.md).
