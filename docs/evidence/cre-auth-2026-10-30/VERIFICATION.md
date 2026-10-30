# CRE authentication and complete CLI readiness retests

Run `20261030T095647Z-d1fc6ff4` passed the USDC price check, then the CRE CLI failed credential validation before stream admission could execute. The [original transcript](original-stream-open.log) reports: `unable to retrieve organization info`. The old policy-process boundary converted the typed CLI failure into a generic `POLICY_SIGNER` error, leaving the terminal with `OPERATION_FAILED`. [Saved failure fields](original-failure.json).

`cre whoami` later returned account details successfully without a new login. This establishes that the account became reachable; it does not prove whether the earlier lookup failed because of a service issue, connectivity or credential infrastructure. No deployment approval or contract redeployment was involved.

The fix makes at most one retry for this specific organization-lookup error **before compilation/execution**, with unchanged command/config inputs and within the original subprocess time budget. Completed failed attempts are saved beside the primary transcript as `*.attempt-N.log`. Invalid/expired credentials, workflow compilation/execution failures and policy results are not retried by this handler. A repeated lookup failure becomes `CRE_ACCOUNT_UNAVAILABLE` with `cre whoami`, conditional `cre login` guidance and a transcript path. Named CLI errors now survive policy-process IPC.

A separate formatting bug was also corrected: spend-review callbacks provide a command string, while price/stream callbacks provide an argument array. Both render correctly in default and verbose modes; tests use the actual string-shaped callback.

## Fresh real preview

`npm run --silent demo:agent` completed run **`20261030T100514Z-bca07ce4`** through Qwen and three local CRE executions:

- USDC price safety: ALLOW.
- Basic stream admission: OPEN, preview only.
- Premium stream proposal: DENY, deposit above cap.

[Terminal output](preview-terminal.log), [selected host result fields](preview-result.json) and [original CRE configs/results/transcripts](preview-policy). No new transaction was signed by this preview. Its three decision receipts remain pending, as expected in preview mode.

The [fresh public RPC check](wallet-rpc.json) found no active stream, next policy nonce **9**, and payer balance **39881352 raw USDC = 39.881352 USDC**, matching both ends of the preview and the balance shown at the start of the failed run. The failed paid invocation had already anchored one audit record using gas; it never funded USDC escrow.

Regression tests cover one-time recovery, persistent errors, original time-budget limits, no retry after compilation/results, expired credentials, failure to save diagnostics, typed IPC errors and string/array command display. The initial retest above was unsigned. Subsequent paid runs and their distinct outcomes follow; no result establishes future Chainlink or RPC availability.

## Paid run #6: initial observation failure and verified cleanup

Run `20261030T101840Z-b204a1c0` funded stream #6 and served ten requests, but the normal CLOSE spend review received `RPC_UNAVAILABLE` and CRE returned ERROR. Signing stopped for that intent. Fresh guarded shutdown checks then authorized cleanup: **1440 raw USDC earned + 8560 refunded = 10000 deposited**. [Original failed CLI output](paid-failed/terminal.log), [failure record](paid-failed/failure.json) and [independent public verification](paid-failed/cleanup-rpc.json).

Both the exact original cancellation call and its gas estimate later succeeded at recorded block `12026050`. The original error's exact RPC operation was not saved. Commit `6f5bd5a` adds at most three initial read-only attempts at the same block/calldata, immutable `simulation/` diagnostics and shared observation caching. Persistent unavailability still becomes ERROR; contract reverts and changed blocks are not retried. Confirmed cleanup now suppresses inappropriate operator-recovery advice.

## Paid run #7: financial completion, failed wallet post-check

Run `20261030T103347Z-808717e0` funded stream #7, served ten calls, passed CONTINUE, closed normally, paid **1320** raw USDC and refunded **8680**. Premium returned DENY, but the CLI rejected its wallet post-check and exited nonzero. [Failed CLI output](paid-failed-snapshot/terminal.log), [failure record](paid-failed-snapshot/failure.json) and [independent closure verification](paid-failed-snapshot/stream7-rpc.json).

The old comparison read balances separately at `latest` and a pending nonce, allowing inconsistent RPC views. The mismatched pair was not retained, so the precise original differing field cannot be established. Commit `7d82fd4` reads both balances and the confirmed nonce at one canonical block and never reads behind known confirmed transactions. It saves denial-check snapshots and block hashes, and detects genuine state changes/reorganizations. A verified normal closure now gets accurate failure guidance too.

## Final paid run #8: complete success after tests

With **239 passing tests** and [green CI](https://github.com/ola-893/agentPay/actions/runs/41043504750), `npm run --silent demo:agent -- --pay` completed run **`20261030T105037Z-247a7f68` with exit code 0** using code `7d82fd4`:

- Stream **#8** funded **0.01 USDC**; ten successful calls reused that stream with unchanged nonce within each request batch.
- Local CRE returned price ALLOW, OPEN, healthy CONTINUE, outage CLOSE and premium DENY. Three explicitly injected HTTP 503 failures triggered the outage checkpoint.
- Normal cancellation paid **0.0012 USDC** and refunded **0.0088 USDC**; the payer's net USDC decrease equals earnings.
- [OPEN](https://sepolia.etherscan.io/tx/0x23d7e8f7bf014995141712ed554ace9fb5a0e0ebd4077411974ea5ea31643488) consumed policy nonce **13**; [CLOSE](https://sepolia.etherscan.io/tx/0xe9793498fab33d7a5e964da9bca0f41ac7b576285d1a6d47a670fa83d4e78a96) consumed **14**. Both policy signatures and their signer-owned CRE evidence hashes verified.
- Four new audit receipt transactions verified **ten** inclusion proofs, including renewed policy observations. No audit decisions remained pending. These transactions are additional to approval/open/close.

[Actual terminal output](paid/terminal.log), [host result](paid/result.json), [public contract verification](paid/rpc-verification.json), [audit proofs](paid/audit-rpc.json), [coherent denial snapshots](paid/deny-verification.json) and [final wallet RPC check](paid/wallet-final-rpc.json). The denial snapshots are at consecutive blocks `12026218` and `12026219` with identical confirmed wallet data; block progression alone does not create a false wallet-change failure. [Original CRE work](paid/policy), [initial simulation diagnostics](paid/simulation) and [final pre-sign diagnostics](paid/presign) are included.

The public verifier also rejected unsigned funding, unsigned closure, agent use of recovery authority and an agent-forged policy approval using read-only calls. It broadcasts nothing. Contract authority remains the separate local operator policy signer; no workflow or contract redeployment was required.

```sh
cre whoami
# Only if the session is invalid:
cre login

# No transaction signing:
npm run --silent demo:agent

# Configured operator, new stream and gas expenditure:
npm run --silent demo:agent -- --pay
```

[Official authentication guide](https://docs.chain.link/cre/guides/cli/managing-auth). Artifact hashes are in [manifest.json](manifest.json). Account email, organization details and credentials are omitted.
