# Agent dashboard events — schema 1

The real CLI emits these events with `npm run --silent demo:agent -- --events ndjson`. Human progress goes to stderr; stdout contains NDJSON events only. It cannot be combined with `--json` or recovery. Existing `--json` envelopes remain available. Events also go to the private run directory as `run.ndjson`; the older model trace `events.jsonl` is separate and is never exported by the dashboard capture tool.

[Runtime validator and reducer](../vite-project/src/lib/run-events.mjs) · [TypeScript definitions](../vite-project/src/lib/run-events.d.ts) · [CLI event adapter](../demo/agent/events.mjs).

Each envelope has exactly `schemaVersion: 1`, `runId`, a contiguous one-based `seq`, ISO `at`, `type`, and object `data`. Timestamps are original observation/emission times, not replay time. Raw amounts are integer strings, USDC has six decimals and ETH has eighteen. A failed, unverified summary can have null amounts; the UI shows “Unverified,” never zero as proof that no payment happened.

| Type | Source and data |
| --- | --- |
| `run.start` | Actual planner provider/model, local profile, Preview/Pay mode, public parties and starting balances. No key, endpoint credentials or model prompt. |
| `step.start` | Actual planning/request/CRE invocation; CRE command uses `cre`, working directory `cre`, and repository-relative config/transcript paths. |
| `cre.result` | Validated price/stream result or spend-review record, target, command, observations, original decision/reason and host-validation status. `source` distinguishes a real local CRE result from an incomplete host review. |
| `api.reuse` | Successful/failed counters for the real funded stream, with optional nonce observations and the host check that the batch used no payment transaction. Earlier captures contain counters only; the UI does not invent nonce evidence for them. |
| `fault` | Explicit injected HTTP 503 outage; not a claimed external provider incident. |
| `wallet.tx` | Approval/open/close hash and submitting/confirmed state. A signed hash is not proof of a mined transaction; only confirmed events are labeled onchain confirmed. |
| `audit.receipt` | Confirmed operator-written root, inclusion count, hash and block. A batch may include pending decisions from earlier previews. These transactions consume separate test ETH. |
| `stream.opened`, `stream.closed` | Contract-checked stream ID, funded amount, earnings and refund. |
| `cleanup` | Attempting, closed or needs-attention for an owned stream after a failed run. |
| `error` | Sanitized code and actionable public message; no raw provider/RPC error or secret-bearing environment value. |
| `run.end` | Completed/denied/failed, verified funded/earned/refunded amounts when available, before/after payment snapshots, lifecycle hashes. Snapshots precede the final audit flush. |

The local server streams the same events using SSE IDs equal to `seq`; reconnects replay stored events and the reducer deduplicates them. The server never computes a CRE decision. It retains the run lock until the CLI exits, even after the final event. If the CLI exits before a complete event stream, the server reports an explicit host error and unverified summary; it does not manufacture a completed capture.

The NDJSON fallback intentionally preserves the existing human formatter instead of refactoring the complete runner. Both are driven by the same host-validated evidence at their emission points; no console parsing or synthetic events are used for recorded runs. Changes to the profile affect only existing policy fields. The fixed service quote remains 0.01 USDC / 1000 seconds, with a premium attempt and injected outage; this UI adds no planner behavior or configurable provider marketplace.

The capture command runs the new emitter, requires the expected outcome and copies only referenced public CRE configs/transcripts. `public/runs/index.json` records the SHA-256 of the byte-identical event stream. The browser verifies it before replay. `npm run docs:check` checks these hashes, original CRE result/transcript equality and accounting. Neither an event nor a saved report is DON authorization.
