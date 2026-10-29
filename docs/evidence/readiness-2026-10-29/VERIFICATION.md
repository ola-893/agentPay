# Single-agent demo readiness — October 29, 2026

The complete local AI + CRE + Circle Sepolia USDC flow succeeded. No contract
redeployment or Chainlink network workflow deployment was needed.

## What changed

- Ordinary failures and graceful SIGINT/SIGTERM request a signer-owned shutdown
  workflow check. Exact stream intent and real health/counter bindings are checked
  before `CLOSE / CLIENT_SHUTDOWN`; cleanup obtains a real EIP-712 permit and uses
  the usual audited cancellation. It does not invent failed service requests.
- Interruption stops new work at safe boundaries and retains exit status 130/143.
  A submitted OPEN is allowed to resolve before attempting cleanup. A submitted
  CLOSE is never duplicated when its outcome is uncertain.
- Admission refresh begins with 30 seconds of headroom before its unchanged
  120-second bound. Fresh evidence replaces the old check; expiry is not extended.
- Business transactions now wait up to five minutes for two confirmations. If
  broadcast/polling fails, the CLI checks that exact hash read-only. Only a
  successful receipt with at least two confirmations establishes success. Missing
  receipts remain uncertain; no automatic transaction resubmission is added.

## Fresh complete run

Run `20261029T093933Z-cb8f17b5`, stream **#4**, exited successfully. Its
[public event stream](../../../vite-project/public/runs/20261029T093933Z-cb8f17b5/events.ndjson)
and linked original configurations/transcripts are in the public run index.

| Check | Observed result |
| --- | --- |
| Model | Real Qwen tool calls; financial parameters remain host-owned |
| Local CRE | USDC price ALLOW; OPEN; fresh admission renewal; healthy CONTINUE; outage CLOSE; premium DENY |
| Funding | `10000` raw = 0.01 USDC; signed OPEN nonce 5 |
| Reuse | Ten successful requests, three injected 503 failures; payer nonce stayed 87 across all request batches |
| Settlement | `1200` raw = **0.0012 USDC** earned; `8800` raw = **0.0088 USDC** refunded; signed CLOSE nonce 6 |
| Recipient balance | `39120` → `40320` raw at the close block; increase equals earnings |
| Access after close | Rejected |
| Premium | 0.2-USDC proposal DENY / AMOUNT_EXCEEDS_POLICY; no funding transaction |
| Audit | Four new receipt transactions, ten inclusion proofs independently checked; the CLI's 33 receipt transactions are cumulative history |

[OPEN transaction](https://sepolia.etherscan.io/tx/0x61a4e05b9948535a946cdba8297c1acfe1ec173323808b1245bc4bddb06331ee) ·
[CLOSE transaction](https://sepolia.etherscan.io/tx/0xde00e19118a8c76e93baa1889f06590c98b512948a928181d13e092bb9d18d01).

[Independent RPC verification](full/rpc-verification.json) checks both signatures,
signed evidence hashes, consumed nonces, closure and recipient balance delta. It
also confirms unsigned funding, unsigned closure, agent-forged approvals and agent
use of owner recovery revert. [Audit RPC verification](full/audit-rpc.json) checks
this run's four new receipt transactions and all ten Merkle inclusion proofs.
[Result summary](full/result-summary.json) excludes cumulative private journal history.

## Deliberate live interruption

Run `20261029T093227Z-c3d1c9d8` funded stream **#3**. The test driver sent SIGINT
after confirmed funding. CRE read the healthy provider and exact stream, returned
`CLOSE / CLIENT_SHUTDOWN`, and the independent policy signer issued nonce 4.

The cancellation was submitted, but the original two-minute confirmation wait
expired. The CLI exited **130**, retained the transaction hash and reported
`needs-attention`. It did not repeat cancellation or silently report success.
Subsequent independent RPC verification confirmed that exact transaction succeeded:
**2040 raw earned + 7960 raw refunded = 10000 raw**, inactive stream and zero active
pointer at the close block. No owner override was used for this live closure.

[OPEN](https://sepolia.etherscan.io/tx/0x4b48ceb79d330621cca26b1cc7fe9a1dd09ff9d61f125d94a20690bb0abe06ec) ·
[Signed shutdown CLOSE](https://sepolia.etherscan.io/tx/0xcda771a5bcae39900d15fea049de736d7d8ff22b89c7ad5c3cd79bdb55493ba3) ·
[Original CLI failure summary](interruption/failure-summary.json) ·
[Independent reconciliation](interruption/rpc-verification.json).

That observed delay motivated the bounded five-minute wait and exact-hash
reconciliation. The original timeout record remains unchanged. It is not labelled
as an automatically confirmed CLI success.

## Hard stop and recovery tests

`guarded-stream.test.mjs` uses a disposable local chain and a six-decimal token.
It checks missing/incorrect cleanup approvals, signer unavailability without an
unsigned fallback, then successful signed cleanup. A child process funds a second
stream and is killed with SIGKILL. The stream remains active; the agent cannot use
owner recovery. The separate owner closes it, and exact recipient/payer balance
changes reconcile with the cancellation event and complete deposit conservation.
This is local contract/adapter evidence, not another public CRE run.

Separate subprocess tests deliver SIGINT and SIGTERM to the actual interruption
controller and check safe-boundary errors, exit codes 130/143 and listener disposal.
A receipt test simulates a lost broadcast response after mining and confirms the
CLI reconciles only the exact successful twice-confirmed hash, without resubmitting.

The public recovery owner also had sufficient ETH for the active stream's current
[recovery gas estimate](interruption/recovery-gas-check.json). No top-up or owner
recovery broadcast was needed during this pass. Gas availability can change.

## Reproduce and verification limits

Run from the configured repository root, with the existing registered payer,
model credentials, separate policy key and authenticated CRE CLI:

```sh
npm run --silent demo:agent -- --pay
node scripts/verify-guarded-stream.mjs 20261029T093933Z-cb8f17b5
npm test
npm run docs:check
npm run typecheck:cre
npm --prefix vite-project run lint
npm run build:web
```

The first command funds a new stream and uses model/API and gas resources. For a
controlled interruption, run `node demo/agent-demo.mjs --pay`, wait for confirmed
funding, press Ctrl+C once, then inspect its `failure.json`, `close.json` and public
receipt before retrying. If an active stream needs owner recovery:

```sh
npm run --silent recover:guarded-stream -- --stream-id <actual-active-id>
```

The public verifier above is read-only and needs the original local run files;
it never overwrites committed evidence. `docs:check` verifies the saved public
proofs offline. [Manifest](manifest.json) hashes original public artifacts and the
[saved test log](checks/tests.txt). The full suite passed **205 tests**; CRE type
checking and frontend lint/build passed. No visual frontend or video change was
required; the earlier video remains a dated recording.

The first live attempt `20261029T092839Z-d28de69f` stopped on POLICY_EXPIRED before
stream funding, after token approval/audit writes. Its [failure summary](initial/failure-summary.json)
is retained. It motivated admission headroom; no policy threshold was weakened.

CRE/network availability and mining latency remain external. SIGKILL cannot run
cleanup. An unavailable signer, mismatched observation or unresolved submitted
transaction still requires inspection and potentially separate operator recovery.
The contract authenticates the local policy signer, not DON execution. The host
and its key files remain trusted, and unrelated EOA transfers are outside escrow.
