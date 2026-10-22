# Compact Workflow redesign — October 22, 2026

This is a presentation change. The local run server, CLI behavior, event schema/types, shared event reducer, public captures and smart contracts are unchanged. No new dependencies or payment transactions were introduced.

## What changed

- A 1200px container, slim navigation and compact title replace the explanatory opening.
- A 340px desktop control surface puts the locally registered agent, shortened/copyable addresses, trimmed USDC, four-decimal ETH, modes and Run together. Recorded mode has scenario chips and a locked policy summary; Live exposes three inputs plus Advanced. Human USDC values convert to raw integers only when building the existing request.
- An SVG/HTML diagram puts observed inputs above CRE and Agent/Wallet/Escrow/Paid service below it. A mobile stepper shares the same pure event projection. Wallet packets, input pulses, call counts and escrow splits are driven by source events. The UI does not evaluate a CRE policy.
- Play/Pause, Step and Restart control recorded playback. Compact timeline rows expand for original observations, raw results, command/config/transcript and explorer links. Hover/focus highlights nodes; node activation finds its latest visible event. Timeline scrolling stays inside its feed on new steps.
- Static explanation moved to Docs. Three linked trust chips and simulation/testnet, test-USDC and unaudited/not-full-x402 labels remain visible. Transaction totals include observed audit receipts, with the lifecycle/audit split in a tooltip.

Missing data stays unknown: the historical captures do not contain per-batch nonce fields, so their call badge does not manufacture “0 txs.” A future event containing the host-checked nonce evidence can display it. A service-unavailable observation does not invent an HTTP status; 503 appears only after its actual injected-fault event.

## Checks performed

| Check | Result |
| --- | --- |
| `npm test` | 183 passing: 32 contracts, 52 SDK, 8 middleware, 31 CRE, 60 tooling/presentation |
| `node --test scripts/test/workflow-view.test.mjs` | Five tests pass: idle/funded/finished, DENY/Preview, unknown/failure handling, integer formatters and compact event-to-node mappings |
| `npm --prefix vite-project run lint` | Pass |
| `npm run build:web` | Pass; existing outdated Browserslist database warning |
| `npm run docs:check` | Pass, including integrity of the four unchanged recorded runs and 15 original CRE results |
| Component server rendering | All four captures rendered at every event prefix without an exception; this is not browser layout or interaction verification |
| Copy budget | 115 words in loaded desktop server-rendered HTML outside the timeline, counting labels/data as well as prose and excluding hidden Details, screen-reader-only text and the duplicate mobile stepper |

The copy budget is a **server-rendered HTML estimate**, not a measured live-browser DOM count. It uses the actual loaded funded-run profile and capture metadata. The browser word count remains unverified.

## Browser verification limit

The browser tool repeatedly returned “Local browser use is disabled in Work settings,” including after the user said they would enable it. No alternative browser automation was used to bypass that restriction.

The requested 1440×900, 1024px and 390px checks, all four captured replays in a real browser, page-overflow measurements, keyboard interaction, reduced-motion behavior, browser console, live DOM word count and new screenshots remain **unverified**. No new screenshots are included, and earlier dashboard images are not evidence of this redesign.

With browser access available, use the running app on port 5317. At each width replay Stream, Preview, Cap DENY and Stale DENY; exercise Pause/Step/Restart, timeline expansion and node navigation. Check the horizontal document width, keep the desktop title/Run/full diagram visible at 1440×900, inspect reduced motion and keyboard focus, then save dated screenshots in this directory. These checks do not require another payment or CRE execution.
