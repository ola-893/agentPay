# UI and UX review — 17 October 2026

**Historical audit of the earlier frontend implementation.** Its command inventory, counts, routes and verification limits describe that revision, not current setup. Use [the current reliability audit](RELIABILITY_AUDIT.md), [CLI guide](AI_AGENT_DEMO.md) and [guarded deployment](GUARDED_STREAMS.md) for current behavior.

The frontend now leads with recorded CRE USDC decisions and uses the same navigation across the workflow, streams, agent setup and documentation.

## Fixed

- Removed the oversized landing hero from the workflow route; decision, request amount, cap and publication status now have a clear hierarchy.
- Replaced overlapping mobile navigation patterns with a persistent, labeled bottom bar. Desktop and nested Docs routes expose the correct active page. Navigation resets scroll and moves focus to main content.
- Added a home link, skip link, visible keyboard focus, route titles, safe-area spacing, reduced-motion support, consistent buttons, and readable slate text on solid surfaces.
- Added recoverable evidence errors, a request timeout, schema/asset validation, exact amount formatting, scenario-specific copy feedback, explicit UTC capture times, and scrollable raw JSON/code panels.
- Removed fictitious wallet notifications and nonfunctional preferences/security controls. Wallet connection has pending/cancellation/error states, disconnect clears local state, account/network changes invalidate the session, and transactions are restricted to Sepolia.
- Replaced the disconnected agent console's fake telemetry, API key and emergency controls with a local integration draft. Validation, browser save/reset and exact six-decimal SDK code generation work without a wallet; the page explains that it does not control a deployed agent.
- Added contract setup guidance to Streams instead of asking users to connect before discovering that deployments are missing.
- Replaced the stream wizard's fabricated balance, unsupported ENS promise and empty default duration. The form uses real balance, validates integer durations and raw-unit flow rates, and explains approval plus creation.
- Transactions lock before asynchronous approval, clean up pending toasts on failure, and check account-session changes before later signing steps.
- Stream discovery failures remain errors, not empty success. Claimable estimates subtract prior withdrawals and release rounding remainder at expiry. Completed active streams can still expose withdrawal. Filters distinguish elapsed, streaming and closed states; pagination stays within valid bounds.
- Withdrawal-by-ID clears stale balance checks on input changes, verifies recipient, and surfaces contract errors. Native confirmation dialogs support keyboard focus, Escape and dismissal while a wallet request is pending.
- Removed fabricated analytics from the legacy dashboard route. Unknown routes show a useful 404 instead of silently redirecting.

## Verified

- Main workflow, Streams, Agent setup and integration Docs at 320px, 768px and 1280px: no horizontal overflow, exactly one H1, no unnamed visible buttons, correct navigation. [Layout observations](evidence/ui-ux/layout-audit.json).
- ALLOW/DENY switching updates amounts, reason and commands; command copy returned the expected value in the browser clipboard.
- Agent draft validation focuses the first invalid field. Saving survives reload, code preserves `0.01 USDC = 10000n`, and Reset clears the test draft.
- Missing evidence was simulated by temporarily moving the ALLOW file: actionable error displayed, then Retry restored ALLOW after the file was returned. The checked-in evidence contents are unchanged.
- The download link points to the selected JSON and its endpoint returned HTTP 200 with `application/json` and valid six-decimal USDC evidence. Browser download-event automation timed out; no completed browser filesystem download is claimed.
- Final normal-page browser logs contained no app errors or warnings. [Desktop](evidence/ui-ux/desktop.jpg) and [phone](evidence/ui-ux/mobile.jpg) captures.
- 109 tests passed: 27 contract, 49 SDK, 8 gateway, 11 CRE policy and 14 tooling/UI state tests. Frontend lint/build, SDK build, CRE typecheck and diff checks passed.

## Verification limits

This checkout has no configured legacy stream deployment or connected test wallet. Live wallet approval, minting, create/withdraw/cancel transactions, wallet-extension event behavior and connected stream-card dialogs were not executed in the browser. Their state calculations and form validation are covered by regression tests; contract/SDK suites passed. No public-chain transaction or deployment was made. No CRE policy, contract or saved CLI execution was changed by this UI pass.

The existing build still reports a large frontend bundle and an outdated Browserslist dataset. These are build advisories, not failures; performance tuning and dependency updates are outside this UI repair.
