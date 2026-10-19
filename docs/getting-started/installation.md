# Installation

Run commands from the repository root unless a different directory is stated. The repository contains the SDK source; these instructions do not assume a published package.

## Frontend and project dependencies

Verified with Node.js **22.23.2** and npm **10.9.8** (CI uses Node 22). Other major Node versions are unverified:

```sh
git clone https://github.com/ola-893/agentPay.git
cd agentPay
npm run install:all
npm run dev
```

Cloning requires GitHub access if the repository is private. Open the Vite URL printed in your terminal. Viewing saved workflow evidence and using Agent setup need no wallet, private key, CRE authentication or deployed contracts.

`install:all` installs root, SDK, server and frontend dependencies. To install only the frontend, use `npm --prefix vite-project install` and `npm run dev`.

For reproducible installs of the committed lockfiles (also used by CI):

```sh
npm ci
npm ci --prefix sdk
npm ci --prefix server
npm ci --prefix vite-project
bun install --frozen-lockfile --cwd cre/payment-guard
```

The final command requires Bun; omit it for frontend-only use. `npm install` may update lockfiles, whereas this sequence installs the committed versions.

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

`docs:check` also compiles the exact documented TypeScript fragments with their declared external inputs and an async-function wrapper, and compares historical transcripts, hashes, frontend copies and ABI report fields. It does not execute payment examples or establish production signature verification.

The current suite has **124 tests**: 29 contract, 52 SDK, 8 gateway, 11 CRE policy and 24 evidence/CLI/tooling checks. Tests and CI do not call the authenticated CRE simulator; successful live executions are separately recorded under `docs/evidence`. SDK/gateway and CLI tests open localhost servers (including temporary Hardhat RPCs), so the environment must permit local listeners.

Build output: `sdk/dist` and `vite-project/dist`. Static frontend hosting needs a fallback to `index.html` for application routes. [Frontend README](../../vite-project/README.md).

## Optional deployments

Follow [deployment](../../DEPLOYMENT.md) before configuring a test wallet or broadcasting. `.env.example` documents server/deployment settings; `vite-project/.env.example` covers public legacy-stream addresses. No `VITE_` variable may contain a private key.
