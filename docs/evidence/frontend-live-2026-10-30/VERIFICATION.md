# Local frontend live demo — October 30, 2026

Tested through computer use in the in-app browser at `http://127.0.0.1:5317/`. The existing Vite process was running; the loopback runner on port 5318 was absent. Starting it with `PAY_ENABLED=1 node demo/run-server.mjs`, then selecting Live and Retry, connected the frontend. Both services were left running after verification. The combined restart command is `PAY_ENABLED=1 npm run dev:live`; stop old instances first to avoid port conflicts.

## Real browser journeys

1. **Unsigned preview:** `20261030T113652Z-ab2565c6` completed with model/CRE calls, price ALLOW, basic OPEN and premium DENY. No transaction was signed. The final UI now explicitly says preview complete/no payment and shows zero calls. [Original events](preview/events.ndjson), [host result](preview/result.json), [screenshot](preview-1440.jpg).
2. **Invalid input:** entering 0.2 USDC above the 0.1 cap disabled Run and showed an inline error. Reset restored the registered value. [Screenshot](invalid-cap-1440.jpg).
3. **Cap denial:** a first attempt (`20261030T114437Z-03847749`) failed repeated CRE organization lookup before execution. [Original failure](account-failed/failure.json) and [attempt transcripts](account-failed/policy). CRE CLI was updated through its official updater from v1.37.0 to v1.39.0, retaining an ignored local backup; [update output](cre-update.log). The next browser attempt `20261030T115437Z-6165bc6e` completed DENY with cap 9999 raw against the 10000 request, zero funding and no signing. [Events](cap-deny/events.ndjson), [screenshot](cap-deny-1440.jpg). The Original transcript link opened the actual CRE output in another tab. This successful retest does not prove the update alone caused recovery or guarantee future account availability.
4. **Funded run:** selected Reset, Pay, the explicit 0.01-USDC-plus-gas checkbox, then Run Pay. `20261030T121320Z-a696d4d4` completed through the browser's local runner and SSE timeline. Reconnect replayed the same active events without starting another payment. The run funded stream **#10**, served **ten successful calls**, passed CONTINUE, injected three HTTP 503 failures, returned CLOSE and settled normally. Premium was DENY. [Original events](pay/events.ndjson), [host result](pay/result.json), [final desktop screenshot](live-completed-1440.jpg).

The funded run paid **1200 raw = 0.0012 USDC** and refunded **8800 raw = 0.0088 USDC** from a **10000-raw = 0.01-USDC** deposit. Payer balance changed from **39.876072** to **39.874872 USDC**. Browser summary: **10 calls, two stream transactions and three audit receipts = five transactions total**. No payment transaction occurred within the request batches.

- [OPEN transaction](https://sepolia.etherscan.io/tx/0xa408fc411f55137b36a6f4e2b5114bce65dca1902381e1df861fee8df12d86e3)
- [CLOSE transaction](https://sepolia.etherscan.io/tx/0x5045e4a57b11ffeae4270096b967c9439a3afda267d3891d214b3660dcb76ecf)
- [Independent Sepolia verification](pay/rpc-verification.json): both local policy signatures, consumed permit nonces, original signer-owned CRE evidence commitments, recipient balance delta, closed stream and deposit conservation. Read-only calls rejected unsigned funding, unsigned closure, agent use of owner recovery and an agent-forged approval.
- [Audit verification](pay/audit-rpc.json): **11** inclusion proofs across three newly emitted audit receipts. The first receipt also included pending records from earlier previews. These are operator receipts, not DON reports.

## UI corrections and responsive verification

- Preview and pre-funding account failures distinguish no funding from unresolved escrow. A failed unsigned run keeps its failed status; it no longer suggests recovery of a stream that was never funded.
- Status messages identify CRE evaluation, spend review/anchoring, signed funding pending confirmation, closure pending confirmation and verified settlement. A CLOSE decision alone never claims a refund.
- USDC displays the labeled run-start/run-end observation. ETH remains labeled preflight/run-start because the UI does not reconcile gas into that number.
- Invalid USDC values have a visible error; disabled policy values retain contrast. Running Pay uses the emitted run mode even if the local development UI refreshes.
- A new run's startup check is visible; duplicate submission is disabled while the runner is known busy. Successful Retry/Reconnect clears stale connection errors.
- Tested browser viewport settings **1440×1000**, **1024×900** and **390×844** against actual events, without injected events or synthetic fixtures. The mobile completed summary shows all payout amounts and the timeline without clipping. [Tablet](live-completed-1024.jpg), [mobile](live-completed-390.jpg), [pending closure](live-closing-1440.jpg), [mobile CLOSE checkpoint](live-close-390.jpg). The browser returns JPEG content captures slightly smaller than its CSS viewport (for example 1432×994 for the 1440×1000 viewport); actual encoded image dimensions are recorded in [screenshots.json](screenshots.json).
- Setup/CRE documentation routes were opened and navigated successfully. No browser error/warning entries were captured during the live run. Temporary evidence/docs tabs were closed and viewport overrides reset; the completed Live dashboard was retained.

The final tooling suite passed **106 tests**. Build, ESLint and documentation checks passed. An earlier parallel tooling run timed out a legacy deployment fixture; its isolated rerun and the final full tooling rerun passed. [Tooling output](tooling.log), [isolated rerun](legacy-fixture-rerun.log), [build](build.log), [lint](lint.log). CI runs the complete repository checks on the committed changes.

## Manual presentation

Keep the configured services running and open `http://127.0.0.1:5317/`. Live is connected; Preview is selected for the next run. To create a new funded demo, Reset policy → Pay → authorize 0.01 USDC + gas → Run Pay. Each Pay invocation creates a new stream and spends gas. Use the diagram/timeline to explain price safety, OPEN, stream reuse, CONTINUE, outage CLOSE/refund and premium DENY. Show advanced includes spend-review decisions and receipt details; transcript links reveal the original CRE work.

Live execution requires local Vite development, registered operator credentials, the separate policy key, Bun, CRE login and working external services. Static hosting only replays recordings. No secrets are in these artifacts, and no schema, reducer, server authorization or payment-contract behavior changed in this UI pass. CRE executes locally; the escrow verifies the separate local policy signature. Future model/API/RPC/authentication/feed availability is not guaranteed by one completed run. [SHA-256 manifest](manifest.json).
