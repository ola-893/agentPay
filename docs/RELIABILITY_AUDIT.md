# Documentation reliability audit — October 26, 2026

This audit checks current guides, frontend documentation, CLI help/output and the
HyperFrames demo against implementation and original execution evidence. Historical
transcripts, addresses and receipts are provenance, not mutable setup instructions.

## Claim-to-evidence matrix

| Consequential claim | Primary evidence | Required documentation correction / check |
| --- | --- | --- |
| Current agent escrow requires local policy approval | `AgentPayGuardedStream._consume`, `createStreamWithPermit`, `cancelStreamWithPermit`; public runtime/deployment record | Name the guarded contract; distinguish local signer authentication from DON execution |
| Agent cannot forge an escrow approval | Distinct agent/policy/recovery constructor checks; EIP-712 domain, nonce, expiry, exact intent; signed contract tests and public negative calls | Scope the claim to this escrow, not all EOA transfers or a compromised host |
| Fixed rules govern lifecycle | `stream-policy.ts`, `demo/policy/worker.mjs`, signer-owned CRE transcripts | Explain proposal → deterministic check → policy signature → contract check; CONTINUE is local |
| Request reuse reduces payment transactions | Signed session service in `streams.mjs`; run `api.reuse` nonce observations | Do not claim zero total gas or per-request CRE/receipt execution |
| Current guarded run succeeded | October 25 run `20261025T173241Z-38db9e1a`; consumed permits; independent RPC balance delta | Video and current walkthrough use this run; fixed historical payouts stay capture-specific |
| A later retest failed | Original healthy-checkpoint CRE authentication failure in run `20261025T182159Z-173753ff` | Record failure honestly; do not present the successful recording as current availability |
| Operator can recover without CRE | `recoveryClose`, distinct owner; confirmed stream #2 recovery receipt | Replace legacy recovery instructions for guarded streams; document owner gas/key prerequisites |
| New checkout can view evidence without keys | Static routes, public run index and artifacts | Separate credential-free replay from operator-only live execution and authority-key custody |
| Deployment command refuses existing records | `deploy-guarded-stream.mjs` record/pending checks | Do not promise a one-command fresh deployment while this checkout contains a deployment record |
| Legacy streams and strict settlement remain separate | `AgentPayStream`, SDK signatures, `AgentPayGuard`/Settlement | Label legacy APIs/closed strict reference; do not retarget old commands to the guarded contract |
| Video narration, captions and proof agree | Source run/hash; signed permit evidence; generated data/script/timing/compositions/MP4 | Rebuild from current guarded capture; check source hashes, signatures, exact snippets and rendered output |

## Verification scope

Repository checks verify links, exact SDK examples, original capture integrity,
unit/accounting consistency and declared authority boundaries. Tests use local
fixtures unless explicitly identified as Sepolia evidence. Build/lint checks do
not establish browser layout correctness. Recorded public receipts establish the
named runs, not future availability. No new payment is needed for this audit. An attempted fresh RPC receipt fetch failed DNS resolution on this host; the new recovery narrative uses the previously verified and saved retest output, and does not claim a fresh chain recheck.

## Reproducible verification

Commands were run from the configured workspace with Node 22, Bun and existing
dependencies. No new model call, payment, contract deployment or CRE execution was
required. Exact documented SDK fragments compile; they are not executed payments.

| Check | Result / scope |
| --- | --- |
| `npm run docs:check` | Expanded to video/manual-demo Markdown, guarded signatures and signed evidence, failed-retest hashes, exact video data/snippets, narration/captions and last-render source manifest |
| `npm test` | Contract, SDK, gateway and CRE suites passed; initial parallel tooling hit temporary-directory cleanup `ENOTEMPTY` |
| `node --test --test-concurrency=1 scripts/test/*.test.mjs` | All 65 tooling tests passed, including tamper rejection for documentation proof; bounded cleanup retries address the temporary-directory race seen in parallel execution |
| `npm run test:tooling` | Normal parallel execution passed all 65 tests after the cleanup fix |
| `npm --prefix vite-project run lint`, `npm run build:web` | Passed; frontend instructions and imports compile |
| `node video/scripts/build-data.mjs --check` | Current guarded capture, signatures, exact code, amounts and generated data agree |
| HyperFrames full check and reviewed frames | No runtime/layout/contrast/readability findings in the final authored composition; all eight chapters and seam frames reviewed |
| MP4 verifier, full decode and audio measurement | Recorded in [video verification](../video/VERIFICATION.md) and its source-hash manifest |

The [saved verification record](evidence/reliability-audit/verification.json) includes commands, results, limits and hashes of the original command logs. The initial failure is retained alongside the successful rerun. Across the contract, SDK, gateway, CRE and final tooling suites, 201 tests passed.

## What is not established

- No independent new-developer onboarding or fresh-machine setup was performed.
  Public replay needs no keys; live registered escrow requires private operator
  authority. The existing deployment helper refuses the committed record.
- CRE availability is external. The successful recording is dated; the later
  authentication failure and recovery remain visible in the docs.
- A fresh RPC receipt fetch during this audit failed DNS resolution. Original saved
  RPC/signature evidence is revalidated offline; no fresh public-chain state is claimed.
- Product-page visual QA was not repeated in this pass. Frontend lint/build and
  content checks passed; video frame QA uses its separate authored composition.
- The contract gate is limited to this escrow and its trusted local signer. It
  does not verify DON execution, constrain other EOA transfers or protect a
  compromised host. Recovery remains an explicit separately funded operator action.

Historical audits/captures retain their original facts and are labelled by revision.
The checks detect the stated drift cases; they do not prove every natural-language
claim correct or guarantee future service availability.
