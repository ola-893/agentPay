# Guarded demo claim-to-evidence map

The film uses `vite-project/public/runs/20261025T173241Z-38db9e1a/events.ndjson`,
the successful October 25 guarded run. Its SHA-256 is checked against the capture
index. `build-data.mjs` verifies the public permits, signed evidence commitments,
consumed-approval records, payout conservation and current escrow before generating
numbers or copying exact source snippets. The thousand-call hook is illustrative;
the recorded demonstration contains ten successful calls.

| Chapter | Claim / visible proof | Raw source |
| --- | --- | --- |
| Fund once | Many calls reuse one funded session; no per-call payment transaction | Guarded escrow accrual; captured api.reuse nonce observations |
| Streaming payments | Agent proposals need deterministic financial guardrails | Host-owned quote parameters; stream-policy.ts; policy worker |
| Why CRE | HTTP + chain observations feed fixed OPEN/CONTINUE/CLOSE/DENY rules | main.ts, stream-main.ts, stream-policy.ts; original CRE transcripts |
| Real workflow | Actual HTTP/EVM source, policy-signature check, unsigned/forged rejection | Exact build-time snippets; AgentPayGuardedStream._consume; saved independent negative RPC calls |
| Recorded run | Signed OPEN, ten calls, healthy CONTINUE, injected outage, signed CLOSE | Actual wallet.tx, api.reuse, fault and cre.result events |
| Settlement | 10000 funded = 1320 earned + 8680 refunded raw USDC; recipient delta 1320; four audit transactions | guarded-stream/rpc-verification.json; consumed OPEN nonce 0 / CLOSE nonce 1; captured audit.receipt events |
| Budget | 0.2-USDC premium proposal vs 0.1 policy cap, DENY before new funding | Captured premium admission and AMOUNT_EXCEEDS_POLICY rule |
| Build | Repository and existing commands | README command checks in builder |

Policy permits authenticate the separate local operator signer, not DON execution
or external observation truth. The agent cannot forge approval for this escrow;
its EOA can still transfer elsewhere. Same-host key custody is trusted. CONTINUE is
local; no onchain write is required for each request. Receipt transactions are
separate from token approval/open/close. The basic/premium trials and outage are
explicitly prompted/injected. No gas-saving percentage or full x402 is claimed.

A later October 25 run failed CRE authentication after five calls and required
operator recovery. It is preserved in `docs/evidence/guarded-retest`, not substituted
into the complete recording. Neither recording promises current service availability.
