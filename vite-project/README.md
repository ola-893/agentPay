# AgentPay frontend

React 19, Vite 7 and Tailwind. The frontend has two destinations: **Workflow** and **Docs**. Workflow explains how prepaid escrow addresses the N+1 payment problem and how local Chainlink CRE supervises the CLI, then displays recorded USDC price-policy evidence. Docs covers the workflow, CLI demo, policy and SDK reference.

Workflow embeds a CRE flow diagram and agent execution dashboard. Recorded mode replays actual CLI events; Live local streams the same CLI through a loopback-only server. There is no browser wallet, draft editor, stream management or separate dashboard route. Payment keys and execution remain in the CLI/server on Ethereum Sepolia.

## Run

From the repository root:

```sh
npm --prefix vite-project install
npm run dev
```

Open the URL Vite prints. Recorded mode needs no wallet, credentials, deployment or frontend environment variables. Use `npm run dev:live` with configured CLI prerequisites to enable Live local. Pay requires server `PAY_ENABLED=1` and explicit UI confirmation.

| Route | Behavior |
| --- | --- |
| `/` | CRE diagram, Recorded/Live local agent dashboard, and optional standalone price-policy captures |
| `/cre` | Redirects to `/` |
| `/docs` and `/docs/:section` | Seven help topics, including the terminal-based CLI demo |

Former agent, stream and dashboard URLs show the normal not-found page. Both desktop and mobile navigation contain only Workflow and Docs. Documentation content is in `src/lib/documentation.mjs`, rendered by `src/pages/Docs.jsx`.

## Recorded evidence

JSON is served from `public/evidence`. With authenticated CRE and Bun installed, refresh from the repository root:

```sh
npm run cre:capture
npm run cre:capture -- --deny-budget
```

Recorded mode does not fetch live oracle prices, run an agent or turn captures into payment authority. Local Vite can launch the real CLI through its same-origin API proxy; hosted builds never call a visitor’s localhost. Circle USDC has six decimals in the separate streaming CLI. See the [CLI guide](../docs/AI_AGENT_DEMO.md) for execution and the [workflow guide](../docs/WORKFLOW.md) for authority boundaries.

## Build and verify

```sh
npm --prefix vite-project run lint
npm run build:web
npm run docs:check
```

Deploy `vite-project/dist` as a static SPA. Preserve the included hosting fallback so nested documentation routes resolve to `index.html`. [Repository docs](../docs/README.md).

[Dashboard modes and local API security](../docs/WORKFLOW_DASHBOARD.md) · [Event schema and captures](../docs/EVENT_SCHEMA.md).
