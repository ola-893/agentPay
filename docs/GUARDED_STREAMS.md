# Onchain enforcement with local CRE

The agent proposes work. A separate local policy process executes the CRE price
and lifecycle workflows, validates their results against registered limits, and
issues a short-lived EIP-712 approval. **AgentPayGuardedStream verifies that
approval before the agent can fund or close its stream.** CRE remains local.

This is verification of a trusted local policy signature, not proof of Chainlink
DON execution. The policy process owns its key; the agent's wallet key cannot
forge an approval. A dedicated operator recovery key can close escrow if the
policy process is unavailable. Neither key is passed to the model or agent
process. The local operator, host files and configured RPC/service remain trusted;
separate processes on the same OS account do not protect against a compromised host.

## What the contract enforces

- Only the registered agent can submit OPEN/CLOSE approvals from the registered
  policy signer. Unsigned legacy create/cancel entry points revert.
- The signature binds chain ID, escrow address, action, agent, recipient, raw
  amount, duration, metadata hash, session ID, stream ID, nonce, expiry and evidence hash.
- A nonce can be consumed once. Expired, forged or altered approvals revert.
  Issued approvals last five minutes; the signer needs a lifecycle result less
  than 120 seconds old when issuing one, plus a valid price result for OPEN.
- At most one funded stream is active at a time. A session cannot be funded twice,
  even after closing it. Each deposit is at most `10000` raw = **0.01 USDC**;
  the rate is at most `100` raw/s and duration at most 3600 seconds.
- The recipient may withdraw earned funds, but cannot cancel a guarded stream.
  Normal cancellation needs a signed CLOSE. Only the separate recovery owner can
  use `recoveryClose` without policy approval.

CONTINUE remains a local checkpoint and request reuse requires no new payment
transaction. This gate protects actions in this escrow. It does not restrict direct USDC transfers
or calls to other contracts from the agent’s externally owned wallet. Restricting
all wallet spending would require a guarded account or vault holding those funds.

The contract does not run HTTP requests, judge answer quality, or
stop accrual automatically when a provider fails. The policy process must observe
failure and the cancellation must be mined. A valid signature authenticates the
policy signer; the contract does not re-execute CRE or the RPC risk review.

## Deploy and run

Use Node 22, compiled contracts, existing CLI credentials, an authenticated CRE
CLI and a dedicated funded Sepolia agent wallet. Keep the root `.env` ignored.

```sh
npx hardhat compile
npm run --silent deploy:guarded-stream
npm run --silent demo:agent
npm run --silent demo:agent -- --pay
```

Deployment creates separate 0600 policy/recovery key files in ignored
`.local/policy/`. It verifies runtime, Circle USDC and all three authorities,
then updates the local stream address and registered profile. Back up those
files privately. A pending deployment hash prevents automatic redeployment after
uncertain confirmation. A recorded guarded deployment also blocks redeployment;
inspect its receipts rather than repeatedly running the command.

Paid agent runs require the guarded contract; they do not fall back to an
unguarded deployment. The CLI still dry-runs and risk-checks the exact signed
calldata, stores decision blobs and requires audit receipts before signing.
The contract independently verifies the lifecycle permit. It does not enforce
that the CLI performed its separate audit-review steps.

## Operator recovery

Inspect the stream and submitted transaction hashes first. Fund the recovery
owner with Sepolia ETH for gas, then run this operator command:

```sh
npm run --silent recover:guarded-stream -- --stream-id 1
```

Replace `1` with the actual stream ID. This command reads only the operator's
recovery key for signing, bypasses CRE deliberately and verifies closure and payout
conservation. It is not an agent tool or an automatic healthy-stream cancellation.
`demo:agent -- --close-stream` remains available for legacy escrow recovery; it
cannot bypass guarded-contract authorization.

## Evidence and limits

The [guarded contract](../contracts/AgentPayGuardedStream.sol) and its
[regression tests](../test/AgentPayGuardedStream.test.js) cover unsigned calls,
forged/changed/replayed/cross-domain approvals, expiry, duplicate funding,
separate recovery authority and earned/refund reconciliation.
The [policy worker](../demo/policy/worker.mjs) signs only decisions from its own
CRE executions and rejects weaker rules, different parties and unregistered
health-service origins. It exposes no generic signing API.

**Verified on Sepolia, October 25, 2026:** guarded stream #1 funded 0.01 USDC,
served ten successful requests, consumed OPEN nonce 0 and CLOSE nonce 1, then
paid **0.00132 USDC** and refunded **0.00868 USDC**. Independent RPC checks verified
both policy signatures, consumed-approval events, closure, recipient balance delta,
and reverts for unsigned funding/closure, agent-forged approval and agent recovery.
[Verification record](evidence/guarded-stream/VERIFICATION.md) ·
[Deployment](deployment/guarded-usdc-stream.json) ·
[Actual recorded events](../vite-project/public/runs/20261025T173241Z-38db9e1a/events.ndjson).

Recheck the completed local run without broadcasting:

```sh
node scripts/verify-guarded-stream.mjs 20261025T173241Z-38db9e1a
```

Run from the repository root with the original local run artifacts and configured
payer/RPC. The verifier signs only an intentionally invalid typed approval for an
`eth_call` rejection test; it never broadcasts a transaction. Recorded amounts are
time-dependent observations, not expected amounts for a future run. Recovery-owner
closure was verified on a disposable local chain, not broadcast on Sepolia.

Earlier legacy [funded dashboard captures](../vite-project/public/runs/index.json) use
the legacy AgentPayStream and remain historical evidence of CLI enforcement.
They are not evidence of this new signature gate. Strict AgentPayGuard/Settlement
and its DON-authenticated report path remain separate.
