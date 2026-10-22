# Workflow dashboard verification — October 22, 2026

The Workflow page now contains a CRE decision-flow diagram and the local/recorded agent dashboard. Navigation remains Workflow and Docs. No contract or DON workflow deployment was required for this change.

## Original CLI captures

Each published event file came from the new CLI emitter, not a hand-authored fixture. See the [capture index](../../../vite-project/public/runs/index.json) and its referenced original CRE configs/transcripts.

| Command | Run | Observed outcome |
| --- | --- | --- |
| `npm run demo:capture -- --preset tiny-cap` | `20261022T111851Z-44992c90` | Price `DENY / AMOUNT_EXCEEDS_POLICY`; no signing |
| `npm run demo:capture` | `20261022T112017Z-489d72f7` | Price `ALLOW`, basic `OPEN`, premium `DENY`; no signing |
| `npm run demo:capture -- --pay` | `20261022T112249Z-556c7ea3` | Stream #5 funded, ten successful API requests, healthy `CONTINUE`, three injected HTTP failures, `CLOSE`, cancellation and refund |
| `npm run demo:capture -- --preset stale-feed` | `20261022T113645Z-8920114f` | Price `DENY / FEED_STALE`; no signing |

These commands make real model, CRE and network calls; `--pay` creates another funded stream. Do not rerun Pay merely to inspect the evidence. Prices, feed age, model behavior and earnings can change on a new invocation.

The recorded Pay run funded **10000 raw USDC**, earned **960**, and refunded **9040**. [Independent public RPC checks](rpc-verification.json) confirmed successful approval/open/close receipts, Circle's six-decimal token binding, the inactive stream, token transfers through escrow and both parties' balance changes at the relevant blocks. Four new audit-receipt transactions also succeeded. Receipt inclusion does not prove external observation truth or DON authorization; batches may include older pending Preview decisions.

## Local API and browser observations

The browser rendered the diagram, Recorded/Live local controls and public agent profile. A Preview was started through the UI (`20261022T114017Z-65955950`); the CLI server log subsequently confirmed basic `OPEN`, premium `DENY`, unchanged USDC balances and no transactions. The completed timeline was **not** visually verified.

A separate real Tiny-cap Preview was exercised through HTTP POST and SSE **through the Vite proxy**. [API evidence](api-tiny-cap.json) records `DENY / AMOUNT_EXCEEDS_POLICY`, zero funded/earned/refunded amounts and no wallet or audit-receipt events. Its original transcript was accessible only through the run's registered-artifact endpoint. This is an API integration check, not a browser interaction test.

Local browser use became disabled in Work settings during verification. Consequently the final desktop/mobile layout, complete Live timeline, Tiny-cap browser interaction, browser console, keyboard journey and static-build replay were not fully verified, and no new dashboard screenshots are claimed or included. Earlier screenshots elsewhere in this repository predate this dashboard.

## Automated checks

- `npm test`: 178 passing tests across contracts, SDK, middleware, CRE and CLI/tooling. Local RPC/HTTP tests require permission to bind loopback ports; the unrestricted rerun is the reported result.
- `npm run build:web` and `npm --prefix vite-project run lint`: pass. Vite reports an existing outdated Browserslist database warning.
- `npx tsc --noEmit --project demo/tsconfig.json` and declaration syntax checking of `run-events.d.ts`: pass.
- `npm run docs:check`: local links, nine exact SDK examples, historical evidence and four dashboard capture hashes/accounting pass; 15 emitted CRE results equal their original simulation transcripts.
- [Static data check](static-data-check.json): all four production-bundle captures pass hash/schema validation and replay through the shared reducer in Node. This does not establish browser rendering correctness.
- Public export scan: the capture files contain no configured private/API key values or private absolute filesystem paths. Private model traces remain outside the public capture directory.

New tests cover strict policy bounds, immutable quote/destination inputs, Preview/Pay validation, schema rejection, nonce evidence, reducer sequencing/deduplication, Host/Origin/session-token restrictions, malformed requests, the run lock, SSE replay and artifact restrictions. CI runs the same test and capture-integrity checks without model credentials or public payments.

## Manual follow-up

With browser access available, configure the existing CLI prerequisites and run `npm run dev:live`. On port 5317, complete a Live Preview, apply Tiny cap and inspect the DENY reason, then test the four Recorded replays. Inspect mobile layout, keyboard controls and console errors, and save dated screenshots here. A static production preview should expose Recorded only. Pay is opt-in and is not needed for these remaining UI checks.
