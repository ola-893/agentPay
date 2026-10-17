# Installation

Run commands from the repository root unless a different directory is stated. The repository contains the SDK source; these instructions do not assume a published package.

## Frontend and project dependencies

Use Node.js **22+** and npm:

```sh
git clone https://github.com/ola-893/agentPay.git
cd agentPay
npm run install:all
npm run dev
```

Cloning requires GitHub access if the repository is private. Open the Vite URL printed in your terminal. Viewing saved workflow evidence and using Agent setup need no wallet, private key, CRE authentication or deployed contracts.

`install:all` installs root, SDK, server and frontend dependencies. To install only the frontend, use `npm --prefix vite-project install` and `npm run dev`.

## CRE dependencies

Install Bun and the [official CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation). CI uses Bun **1.3.12** and the workflow pins `@chainlink/cre-sdk` **1.23.0** in its package manifest/lockfile.

```sh
npm run install:cre
cre login
npm run cre:dry-run
```

CRE login/account access and network connectivity to CRE services, Coinbase and Sepolia are required for live simulation. No wallet funds or private key are required by the read-only runner. [Workflow guide](../WORKFLOW.md).

## Verify installation

```sh
npm run docs:check
npm test
npm run build:sdk
npm run typecheck:cre
npm --prefix vite-project run lint
npm run build:web
```

The current suite has **109 tests**: 27 contract, 49 SDK, 8 gateway, 11 CRE policy and 14 tooling/UI-state checks. Tests and CI do not call the authenticated CRE simulator; successful live executions are separately recorded under `docs/evidence`. SDK/gateway tests open localhost servers, so the environment must permit local listeners.

Build output: `sdk/dist` and `vite-project/dist`. Static frontend hosting needs a fallback to `index.html` for application routes. [Frontend README](../../vite-project/README.md).

## Optional deployments

Follow [deployment](../../DEPLOYMENT.md) before configuring a test wallet or broadcasting. `.env.example` documents server/deployment settings; `vite-project/.env.example` covers public legacy-stream addresses. No `VITE_` variable may contain a private key.
