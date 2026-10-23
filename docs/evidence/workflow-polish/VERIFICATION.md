# Workflow polish — October 23, 2026

Only `WorkflowDashboard.jsx`, `WorkflowDiagram.jsx` and their CSS changed. The schema, reducer, server, run hook, CLI, contracts and captured events remain unchanged.

## Implemented

- Idle text retains full opacity. Only decorative input, supervision and reuse paths dim; the main payment edges and “fund once” label remain fully visible.
- The diagram's sole Recorded primary action sits in the bottom band below the nodes. The control card has no Recorded Replay button; the neutral playback bar remains. Live retains its card Run action.
- Desktop icon tiles are 80px; mobile tiles are 72px. Each node has a label and three-word caption. Input pills have icons, borders and event-triggered pulses.
- Policy values explicitly name the deposit cap, max rate in USDC/s, max feed age in hours when exact, and max failures. The rate tooltip identifies a policy upper bound, distinct from the quote's streaming rate.
- Recorded scenario buttons form a 2×2 grid: Funded run, Preview (no txs), Cap DENY, Stale DENY.
- Idle shows a zero-call placeholder. Missing call observations during an actual run remain unknown. The Live dot uses green/amber/gray for ready/busy/offline, with a tooltip and screen-reader status.

## Checks

- Frontend lint and production build pass. The build retains the existing Browserslist freshness warning.
- The five existing workflow presentation/formatting tests pass.
- The four actual captures render at every event prefix without a React server-rendering exception. Fixture checks confirm one primary action in Recorded and in each Live runner state, no primary action in the Recorded card, and the corrected scenario/policy labels. [Component results](component-checks.json).
- Source-palette text contrast ranges from **6.92:1** to **14.39:1**, above the requested 4.5:1 minimum. Decision badge backgrounds are composited in the calculation. There is no container opacity on idle text. [Palette calculation](contrast.json). This is a CSS source check, not a browser computed-style accessibility audit.

## Browser verification remains blocked

The browser tool still returned **“Local browser use is disabled in Work settings”** after the user confirmed access was enabled and after resetting/reconnecting the browser tooling. No alternative automation was used to bypass that restriction.

The requested 1440px, 1024px and 390px screenshots at price-check, CLOSE and DENY states are **not verified or captured**. Neither overflow measurements nor the final rendered positioning/contrast were established in a real browser. The source changes and component checks must not be mistaken for those visual checks.

Once browser access works, replay Funded run at each width and pause at price safety and CLOSE, then replay/pause a DENY scenario. Verify the payment edge is unobstructed, there is no horizontal page overflow, and each idle label is readable before saving screenshots here. Recorded replay requires no new payment or CRE execution.
