# Prepare the repository for recording

This pass updates the repository only; it does not record a video or broadcast a transaction.

## Run both scenarios live first

```sh
npm run cre:dry-run
# Optional: preserve the dry-run transcripts under a new versioned evidence folder.
npm run cre:dry-run -- --save-evidence
```

The command executes **`npm run cre:simulate`** and **`npm run cre:simulate -- --deny-budget`** sequentially. It verifies the actual successful CLI results, the expected ALLOW / budget DENY decisions, and more than 600 seconds of remaining feed freshness in each execution. Override the planned recording window with `--recording-window=900` for fifteen minutes.

It fails if an input is stale, an unexpected guard fires, or the headroom is too small. A pass describes the dry-run time only, not a promise that the next run will pass. Repeat immediately before recording. Do not loosen the configured freshness/deviation checks just to make an ALLOW shot. If the underlying feed is near expiry, wait for an update and rerun. Show both npm commands executing live during the eventual recording.

The current `docs/evidence/cre-allow.*` and `cre-deny-budget.*` files stay intact during dry runs. They are a transparent, labeled backup if live input conditions change. Successful `cre:capture` refreshes first retain previous JSON, frontend copies, and transcripts under a content-addressed `docs/evidence/backups/` directory. Failed captures do not replace them.

Latest saved dry run: [summary](evidence/preflight/2026-10-16T23-18-39-479Z/summary.json), [live ALLOW command](evidence/preflight/2026-10-16T23-18-39-479Z/allow.log), and [live budget DENY command](evidence/preflight/2026-10-16T23-18-39-479Z/deny-budget.log). Both had more than 82,700 seconds of freshness headroom at that execution; this is historical evidence, not a guarantee about a future run.

## Explain the payment-asset check

> “AgentPay’s guarded path uses Circle’s six-decimal Sepolia USDC. CRE compares Coinbase and Chainlink USDC/USD and requires each source to stay within 1% of $1. Even if both sources agree on a depegged price, the request is denied. We also check oracle freshness and a per-request spending cap. Sepolia tokens have no monetary value; these observations model payment-asset risk.”

[Verified USDC addresses, faucet, raw-unit examples and freshness limit](USDC_SEPOLIA.md). The USDC/USD feed’s listed heartbeat is 86,400 seconds and the sample max age is the same. This testnet demonstration does not promise immediate depeg detection. Earlier ETH/USD transcripts are retained as historical backups of the previous policy; use the refreshed USDC captures for this submission.

## Optional public-chain write demo

The strict `AgentPayGuard` is unchanged. Its workflow identity checks remain required for payment authorization. It cannot accept the simulator's missing metadata.

For the optional shot, the separate `AgentPaySimulationReceiver`:

- accepts only its configured mock forwarder, with an explicit constructor opt-in to skip workflow identity;
- is limited to Sepolia and the local test chain;
- still checks destination, expiry, replay and report parties;
- exposes `simulationOnly = true` and `skipWorkflowIdentity = true`;
- has **no payment authorization or settlement API**. Its event proves demo receipt delivery, not a trusted production payment authorization.

This follows Chainlink's documented [simulation metadata limitation](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts): the simulator uses a different mock forwarder and does not supply production workflow identity metadata. The documented Sepolia mock address is `0x15fC6ae953E024d975e77382eEeC56A9101f9F88`. Recheck the [official directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory) before deploying.

### Operator steps (spend Sepolia test ETH)

No funded deployment wallet was configured or used in this repository update. These steps are prepared for a dedicated test wallet:

1. In ignored `.env`, set `DEMO_PRIVATE_KEY` for a dedicated funded **Sepolia test wallet** and `ALLOW_SIMULATION_DEMO=true`. Do not use a mainnet/production wallet or commit the key.
2. Run `npm run deploy:cre-demo`. The dedicated `sepolia-demo` network uses only `DEMO_PRIVATE_KEY`; it does not reuse `PRIVATE_KEY`. The script checks chain ID and mock-forwarder code, deploys the explicitly labeled receiver, and saves a non-secret manifest in `.local/cre/demo-deployment.json`.
3. Run `npm run cre:simulate:write` first. This simulates report delivery **without broadcasting** and does not claim a public receipt.
4. When ready to send the optional testnet transaction, run:

```sh
npm run cre:simulate:write -- --broadcast --capture
```

The runner uses the dedicated demo wallet for CRE's `CRE_ETH_PRIVATE_KEY`, generates a fresh request ID, and checks the deployed receiver's simulation flags and forwarder. After broadcasting it independently checks the RPC receipt, sender/forwarder, receiver event, exact request ID, decision, expiry and report-body hash. Only then does it save an Etherscan link under `docs/evidence/onchain-demo/` and label the receipt verified. The evidence explicitly states workflow identity was **not** authenticated.

The workflow's `reportWriteSucceeded` flag by itself is insufficient proof of publication: CRE can simulate a successful write without `--broadcast`. `published` remains false in the workflow result; verified publication is a separate host-side `publication` record backed by a receipt and matching event. No Etherscan transaction or demo deployment is claimed until those operator steps actually succeed.
