# Workflow frontend verification — October 29, 2026

Frontend presentation changes only. The event schema, reducer, local server, CLI
and deployed contracts were not changed. No new AI/CRE run or payment was made.

## Behavior verified

- Four latest scenario chips; dated older-capture selector. The actual browser
  selected the October 22 capture, showed its legacy enforcement description,
  then returned to the latest funded capture and its guarded-contract description.
- Policy signature → wallet submission → contract verification strip. Idle Live
  mode waits for evidence rather than claiming legacy or guarded enforcement.
- Requesting shutdown approval, passed shutdown check, pending close, confirmed
  receipt while settlement is checked, and unresolved-confirmation displays.
- A confirmed settlement retains its amounts when the overall run is interrupted.
  Missing confirmation never becomes a closed/refunded claim. Pending hashes link
  to Etherscan for inspection.
- Shutdown checks use that name rather than “Outage checkpoint.” Attempting
  cleanup uses “Checking,” not “Attention.” An ancillary spend ALLOW cannot hide
  the lifecycle CLOSE badge; a spend block/error can still take precedence.
- Integer-safe USDC formatting and existing policy/request behavior are retained.

The browser checked four cleanup states at **1440, 1024 and 390 pixels** with no
horizontal overflow, and saved the corresponding `fixture-*.jpg` screenshots.
Desktop/tablet and phone images were visually reviewed. The passed shutdown check was also inspected in that page; receipt-confirmed
settlement-pending behavior is covered by the presentation tests.

**Fixture disclosure:** those images visibly say “UI test fixture · reconstructed
display states · no transactions.” The confirmed interruption case reconstructs
presentation events using the saved interruption RPC accounting; the original CLI
reported a timeout. These screenshots do not replace that original evidence or
claim another completed live run. The temporary fixture page was removed after QA.

The production Workflow page also replayed the actual October 29 capture through
all 44 events: ten requests, closed stream, 0.0012 USDC earned, 0.0088 USDC refunded
and premium DENY. These are the actual recorded events, not reconstructed fixtures.

[Actual completed replay, desktop](recorded-complete-1440.jpg) ·
[Actual completed replay, phone](recorded-complete-390.jpg) ·
[Actual price check, tablet](recorded-price-1024.jpg) ·
[Fixture unresolved confirmation](fixture-unresolved-1440.jpg) ·
[Fixture interrupted and settled, phone](fixture-settled-390.jpg).

## Checks

```sh
npm run test:tooling
node --test scripts/test/workflow-view.test.mjs
npm --prefix vite-project run lint
npm run build:web
npm run docs:check
```

All **71 tooling tests** passed. The presentation file's **nine tests** include
shutdown/uncertainty/settlement transitions, negative shutdown reasons, stable
latest/history selection, legacy/current evidence and lifecycle badge precedence.
Lint, production build and documentation checks passed. Saved outputs are beside
this file; [verification metadata](verification.json) hashes the UI sources and
screenshots. Browser QA used local Vite on port 5317. The local paid runner was
not started; its disconnected indicator was checked rather than running payments.
