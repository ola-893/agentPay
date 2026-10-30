# CRE account-validation failure and unsigned retest

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

Regression tests cover one-time recovery, persistent errors, original time-budget limits, no retry after compilation/results, expired credentials, failure to save diagnostics, typed IPC errors and string/array command display. The full suite passed before the final timer-budget refinement; the targeted authentication/output suite passed afterward, and GitHub CI runs the final full suite. The new live test was unsigned; this evidence does not claim a new paid lifecycle or future Chainlink service availability.

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
