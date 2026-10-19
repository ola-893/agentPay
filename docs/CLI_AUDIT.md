# CLI contract audit

Scope recorded before implementation changes, 19 October 2026, baseline `396d0c0`. The interface is a set of npm scripts, not an installed `agentpay` executable. No guarded payment, agent-registration, stream-withdrawal or stream-cancellation CLI command exists. Those journeys currently require SDK/contract calls or the frontend; this audit will not invent commands to fill the gap.

## Baseline behavior-to-evidence matrix

| Existing command | Flags/defaults, units and authority | Output/exit contract in source | Evidence / discrepancy |
| --- | --- | --- | --- |
| `cre:simulate`, `cre:capture` | `--deny-budget`, `--capture`; default sample ALLOW, USDC 6 decimals, price scale 8; preview forced; CLI account and RPC/API access | Streams CRE text, writes local JSON; 0 on expected scenario (including budget DENY), unhandled exceptions -> 1 | `simulate-cre.mjs`, `policy.ts`, original transcripts. Unknown flags, `--help`, `--json` silently ignored. Result validation checks some identity/units but not complete intent/ABI/policy equality. |
| `cre:dry-run` | `--save-evidence`, `--recording-window=N` (600, range 1–3600); invokes both scenarios; needs >window freshness headroom | Text plus summary JSON; 0 iff both ready, 1 otherwise | `preflight-cre.mjs`, `cre-evidence.mjs`. Unknown options ignored; `--recording-window 900` ignored; help executes live work. Child spawn/timeout errors are unstructured. |
| `cre:simulate:write` | `--broadcast`, `--capture`; default nonbroadcast simulation; explicit opt-in, dedicated key for broadcast, Sepolia mock deployment manifest | CRE text plus evidence JSON; public claim requires verified receipt/event; exceptions -> 1 | `simulate-cre-write.mjs`, `cre-demo.mjs`, isolated receiver tests. Unknown flags/help ignored; nonbroadcast inherits a possibly configured `CRE_ETH_PRIVATE_KEY`; no receiver-bytecode check or complete output/config match before receipt checks. Mock receiver never grants payment authority. |
| `deploy:guard` | Hardhat `--network sepolia`; root key/RPC, production forwarder and optional workflow ID; 0 ID leaves reporting closed | Mixed deployment JSON/text; 0 success, caught error -> 1 | `deploy-guard.js`, Hardhat config, guard/settlement contracts. No explicit signer, Sepolia or forwarder-code check in script; malformed workflow ID may be discovered only after deployment begins. |
| `deploy:cre-demo` | Hardhat dedicated `sepolia-demo`, explicit opt-in/demo key; mock forwarder fixed | Manifest + warning; 0 success, 1 failure | `deploy-cre-demo.js`. Already checks Sepolia and forwarder code. Hardhat owns flags/help; do not forward application `--json` to Hardhat. |
| `deploy:sepolia` | Hardhat Sepolia; deploys new MockUSD (18 decimals) + stream; root key/RPC | Human addresses; 0/1 | `deploy.js`, `MockUSD.sol`, `AgentPayStream.sol`. No explicit key/network validation before accessing signer. No checked-in public deployment assumed. |
| `demo:check` | No implemented flags; `PRIVATE_KEY_1`, RPC default publicnode, stream/token addresses; 18-decimal assumptions | Human text; **returns 0** for missing key/network/deployment failures; catch only logs | `demo/check-setup.ts`. No chain, decimals, stream-token binding or recipient validation; can hang on provider retries. Help attempts normal work. |
| `demo:consumer` | No implemented flags; same key/RPC/addresses, provider fixed port 3005; auto-mints below 10 tUSD, negotiates a 3600s stream; may spend test ETH/tUSD | Human logs; caught failures/returns can still exit **0**; labels negotiation count as transactions saved | `demo/consumer.ts`, `AgentPaySDK.ts`. No pre-signing Sepolia/18-decimal/binding validation, no reliable failure status, providers not destroyed. No full current x402 implementation. |
| `demo:provider` | No implemented flags; fixed port 3005, stream/token/recipient/RPC env; rates 0.0001 / 0.001 tUSD per second | Startup text/server; no validation before announcing readiness | `demo/provider.ts`, middleware. Missing/mismatched configuration can start a server that advertises unusable payment requirements. Stream ID is public, not authenticated payer identity. |
| Guarded SDK / stream management | **No corresponding CLI**; guarded pay needs fresh authenticated tuple, positive amount <= report maximum; smaller payment consumes entire request; legacy SDK assumes 18 decimals | SDK promises, Solidity reverts/receipts; no CLI flags/help/JSON to test | `GuardedPaymentClient.ts`, `AgentPaySDK.ts`, `AgentPayGuard.sol`, `AgentPaySettlement.sol`, `AgentPayStream.sol`. Test real local contracts and mark public deployment/wallet requirements explicitly. |

Build/install/test/frontend scripts are infrastructure rather than payment interfaces. They will be run as verification; upstream npm, Hardhat and CRE retain their own help/flags. Existing saved simulations do not authorize a payment and do not prove production DON deployment or a public settlement receipt.

## Verification plan and limits

Use a disposable clone with locked installs, no copied `.env`, and the host's installed tools/caches. Record baseline failures before changing code. Then exercise help without network/keys, strict argument errors, one-object JSON success/failure, exact USDC policy/ABI validation, and legacy preflight against a local Hardhat JSON-RPC server and deployed test contracts. Test missing/invalid keys, wrong network, no bytecode, token mismatch/6 decimals, balance/allowance boundaries and failed operations. Exercise authenticated-guard behavior with a trusted local test forwarder; that does not establish real DON delivery or Circle settlement. Public deployment/broadcast remains unexecuted without funded dedicated wallets and account deployment access.

## Resulting command contract

Implementation verified at `2b43044` from a clean clone on 19 October 2026. No new product command was added.

| Wrapper | Accepted options / defaults | Successful output and exit |
| --- | --- | --- |
| `cre:simulate` | `--deny-budget`, `--capture`, `--help`, `--json`; default ALLOW preview | Existing evidence object under JSON `data`; 0 for the expected decision, including budget DENY |
| `cre:capture` | Alias of `cre:simulate` with `--capture` already set | Same canonical JSON command name `cre:simulate`; backs up previous files before writing |
| `cre:dry-run` | `--save-evidence`, `--recording-window=N` or `--recording-window N`, `--help`, `--json`; default 600, integer 1–3600 | Readiness summary under `data`; 0 only if both scenarios match and freshness headroom is strictly greater than the window |
| `cre:simulate:write` | `--broadcast`, `--capture`, `--help`, `--json`; preview by default; opt-in and local manifest required | Mock demo evidence under `data`; public `publication` only after explicit broadcast plus verified RPC receipt/event; no payment authority |
| `demo:check` | `--help`, `--json`; existing environment variables | Read-only deployment/wallet result; raw tUSD and wei balances are strings; 0 only with valid configuration/deployment and nonzero gas balance |
| `demo:consumer` | `--help`, `--json`; provider still fixed to port 3005 | May mint/approve/escrow test tUSD; 0 only after four successful `makeRequest` calls; failures stop the demo |
| `demo:provider` | `--help`, `--json`; port 3005 | One readiness envelope after deployment validation and listener binding; continues running, logs to stderr in JSON mode |
| Three deployment scripts | Existing Hardhat flags/help; application `--json` is **not** supported | Existing human/deployment output; 0 success / 1 failure. Hardhat owns argument parsing and errors |

Use `npm run --silent <script> -- --json` to suppress npm's own banner. The application emits one JSON object per completed invocation:

```json
{"schemaVersion":1,"ok":false,"command":"demo:check","error":{"code":"CONFIG","message":"PRIVATE_KEY_1 must contain a valid dedicated test-wallet private key."}}
```

Success uses `data` instead of `error`. A completed but unsuccessful readiness check retains its summary as `data` with `ok: false`, `data.ready: false` and exit 1. Progress is on stderr; amounts remain decimal integer strings. `--help --json` returns the help text under `data.help` and performs no action. The evidence/result schema inside the envelope remains version 2; no old capture format was changed.

The six application wrappers use 2 for usage/config errors, 1 for operational/result-validation failures, and 0 for success. CRE subprocess interruption returns 130/143 for SIGINT/SIGTERM. Spawn errors and bounded timeouts fail rather than manufacturing success. [Help and JSON snapshots](../scripts/test/snapshots/cli.json) freeze these interfaces.

## Verified fixes and compatibility changes

- Unknown, positional, duplicate and wrongly valued options now fail with exit 2; they previously could be ignored. This is an intentional change for scripts that relied on ignored arguments. Both recording-window syntaxes are accepted; a separated value was previously ignored.
- Help exits before loading config/keys, making RPC calls, invoking CRE, starting a listener or sending a transaction. Optional JSON output is additive; default human output remains available. Errors are concise and redact known secret environment values instead of dumping SDK stacks/serialized transactions.
- Missing/invalid configuration now fails with exit 2. Legacy checker/consumer failures previously could return 0; this breaking correction is deliberate. Setup now requires the recipient alongside stream/token addresses, because the provider cannot validate its payment policy without it. Provider readiness now requires a usable deployment and a bound listener.
- CRE config uses the actual workflow schema before execution. Returned output is bound to full intent, six-decimal units, policy limits, receiver, chain, expiry and all nine ABI fields. Observable price/freshness/peg/budget conditions are re-evaluated with the workflow's actual policy function. Both previews remove an inherited `CRE_ETH_PRIVATE_KEY`; only explicit demo broadcast passes the dedicated demo key.
- Legacy signing now rejects non-Sepolia networks, mismatched/non-18-decimal tokens, invalid uint256 amounts, fractional/zero-rate durations and insufficient token balance before approval. Previously unchecked configurations may now fail. Approval/settlement receipts must have status 1.
- A [real local consumer failure](evidence/cli-audit/nonce-regression-before-fix.log) reproduced approval/creation nonce reuse. Sequential transactions now coordinate nonces. The guarded SDK is tested with a plain ethers wallet as well. An instance does not coordinate unrelated processes or external transactions using the same signing wallet.
- Guard deployment checks workflow ID syntax and deployed forwarder code before sending transactions, rejects the known mock forwarder for production identity, and requires a deployment wallet on Sepolia. The strict contract's identity, expiry, destination and replay rules were not weakened.
- Consumer output no longer labels negotiation counts as measured blockchain transactions or gas savings. `requestsSent` counts SDK `makeRequest` invocations (including failures), not every underlying HTTP attempt; the first successful invocation also includes the initial HTTP 402 and retry.

## Reproduced evidence

The [baseline transcripts](evidence/cli-audit/baseline/summary.json) preserve failures observed before code changes, using an intentionally missing CRE executable for safe argument/help checks. They show missing-key checker and consumer failures exiting 0, help entering normal execution, and ignored options.

The corrected [clean-checkout summary](evidence/cli-audit/verification/summary.json) records **43 command invocations**, their expected and actual exit codes, and separate stdout/stderr files. Both the initial and final tracked/untracked tree state were clean. Locked npm/Bun installs, docs checks, demo typecheck, all tests, SDK/CRE/web builds and lint passed. The checkout shared the host's installed tools, caches and existing CRE login; this was not a fresh-machine bootstrap or an independent developer onboarding session.

**124 tests passed:** 29 contracts, 52 SDK, 8 middleware, 11 CRE policy, 24 tooling/CLI. [CLI subprocess tests](../scripts/test/cli-contract.test.mjs) cover help/JSON snapshots, invalid flags, missing credentials/executable, timeouts, corrupted/stale output, and refusal to replace evidence on failure. [RPC tests](../scripts/test/cli-rpc.test.mjs) deploy real local contracts, run all three deployment scripts, start the real provider, mint/approve/create a stream through the consumer and reuse it, reject port conflicts and bad deployment/units/network/gas, and settle through the guarded SDK. Insufficient token balance and insufficient allowance independently revert without consuming authorization.

Twenty [local RPC command/SDK records](evidence/cli-audit/local-rpc/1.json) retain original outputs. Every record is labeled `localFixturesOnly`; the node uses test accounts and a test chain ID of 11155111 to exercise Sepolia-only guards. Fast local blocks allow equal timestamps so the gateway's wall clock is not behind artificially future block times. Production metadata is locally constructed for contract testing; no DON signature is exercised. The write wrapper success test uses an explicitly synthetic CRE subprocess and proves host-side handling, not real CRE report delivery.

Fresh **real CRE CLI** executions used live Coinbase and finalized Sepolia reads:

- The first ALLOW hit Coinbase's request deadline and exited 1. Its [stdout](evidence/cli-audit/verification/38-live-allow.stdout.log) and [stderr](evidence/cli-audit/verification/38-live-allow.stderr.log) are retained; no success was claimed.
- ALLOW retry, budget DENY, the two-scenario dry run and the capture alias then succeeded. The dry run used a **900-second** window and had 41699 / 41689 seconds of headroom. These are observations at execution time, not future guarantees.
- The capture alias produced [new preview JSON](evidence/cli-audit/verification/captured-cre-allow.json) and [transcript](evidence/cli-audit/verification/captured-cre-allow.log), backed up the previous capture, and passed the integrity checker. The disposable checkout's tracked captures were restored afterward; the frontend's existing historical evidence was not replaced in this audit.

The [evidence generator](testing/cli-audit-20261019.py) contains the exact verification sequence and failure inputs. With Node 22, npm, Bun, CRE and account access installed, run it against a **disposable clean clone**:

```sh
python3 docs/testing/cli-audit-20261019.py /absolute/path/to/disposable/agentPay
```

It reinstalls locked dependencies, temporarily changes/restores config for failure cases, starts local test servers, executes live **read-only** CRE, and tests capture/backup in that disposable clone. Output is under `.local/cli-audit/verification`; network access and localhost listeners are prerequisites. The [GitHub Actions workflow](../.github/workflows/ci.yml) runs the credential-free checks, including demo typechecking and local RPC regression tests.

## Explicit verification limits

- No live DON deployment, authenticated public report delivery, public deployment of AgentPay contracts, Circle USDC settlement, browser wallet transaction or `--broadcast` was exercised. These require real deployment access, workflow identity and funded dedicated test wallets. Local receipts and synthetic subprocess output are not public-chain evidence.
- There is no CLI command to prepare/register a running agent, invoke guarded `pay`, withdraw a stream or cancel it. Guarded settlement was tested through the SDK; withdrawal/cancellation remain contract/frontend journeys covered by existing local contract tests. Adding commands was outside this audit.
- CLI config/deployment owners and the configured RPC remain trusted. Checking bytecode presence, decimals and token binding does not authenticate a contract's code identity or prove that a configured forwarder is Chainlink's official deployment.
- Valid raw integers cannot reveal an operator's intent: an amount mistakenly calculated with 18 decimals can still be a valid six-decimal integer. The tool validates declared units/bindings and demonstrates `0.01 USDC = 10000`; operators must review their amount and cap. No implicit rescaling was introduced.
- The result omits `answeredInRound`; completed-round validation is performed by the workflow and its policy tests, not independently reconstructed by the wrapper. Evidence hashes/tuple checks establish consistency, not signatures. An altered CRE executable and fabricated source observations are outside that guarantee.
- Approval may spend gas before a later expiry or failed settlement. Failed token transfer rolls authorization consumption back; it does not extend expiry. Signing wallets must not be concurrently controlled by unrelated clients/processes.
- Existing prototype/gateway authentication limitations, unaudited contracts and dependency advisories remain. This is a correctness audit, not a security certification or full x402 implementation.
