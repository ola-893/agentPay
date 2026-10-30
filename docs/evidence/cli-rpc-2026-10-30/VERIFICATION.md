# CLI RPC failures and successful retest — October 30, 2026

The corrected CLI completed run `20261030T082619Z-38e45bad` on Sepolia using Qwen and real local CRE executions. Stream **#5** funded `10000` raw USDC, served **10** successful requests on one stream, passed CONTINUE, and closed after three deliberately injected HTTP 503 failures. Cancellation paid **1200** raw USDC to the recipient and refunded **8800** raw USDC. The premium proposal was denied. USDC has six decimals.

- [OPEN transaction](https://sepolia.etherscan.io/tx/0x8fb8f36741ea5249a70bb8d6cb7f8d2cd12c1f681b9e98b47f9af2fa30c30798)
- [CLOSE transaction](https://sepolia.etherscan.io/tx/0x595ff7f2619119574def27ee30e23fce347cb7ae73af16a4b74ee0fa1bee3754)
- [Original terminal output](success/terminal.log), [host result](success/result.json), [public contract verification](success/rpc-verification.json) and [audit verification](success/audit-rpc.json).

Public RPC verification checked both policy signatures and consumed nonces, closed stream state, recipient balance delta and deposit conservation. Read-only contract calls rejected unsigned funding, unsigned closure, agent use of owner recovery, and an agent-forged policy signature. Three new audit receipts contain seven decisions; all seven inclusion proofs verified onchain. The original cumulative journal counts are preserved separately from this run's receipt subset. The four successful [pre-sign checks](success/presign) are host diagnostics, not extra CRE decisions.

## What failed and what changed

The user's original run `20261029T153720Z-a8c308af` stopped with `Fresh pre-sign simulation failed` after a confirmed token approval. No stream opened. The exact historical call and gas estimate succeeded at blocks `12020461`, `12020466` and `12020470`, while the permit was still valid. [Saved diagnosis](original-failure.json) and [fresh historical replay](original-replay.ndjson). The old CLI discarded the underlying RPC error, so its precise cause cannot be proved retrospectively.

Commit `874149f` saves immutable, fsynced pre-sign attempts with safe RPC operation/error codes and makes up to three read-only attempts for availability failures. EVM reverts, changed blocks, invalid intents and failed evidence writes stop immediately. Intent/calldata/expiry checks remain in force, and there is no automatic transaction resubmission. The failure hint distinguishes stopping before funding from a potentially submitted stream transaction.

The first new attempt (`20261029T200211Z-dbfd41b4`) stopped during deployment verification with a request timeout, before model/CRE activity or any transaction. A later read-only verification succeeded. The next attempt (`20261030T081657Z-7368b5c2`) reached spend ALLOW but failed the post-confirmation receipt check against `latest` state. Failure handling subsequently reconciled that same receipt without rebroadcast. Both its receipts were independently verified at their canonical blocks: [original failure and batch records](receipt-mismatch-failure.json), [RPC verification](receipt-rpc-verification.json). The mismatched RPC return values were not saved; stale load-balanced state is the supported explanation, not a captured provider error.

Commit `8727c20` verifies a receipt's destination, writer, event and root/sequence at its exact confirmed block, checking the canonical block hash before and after the state read. Decision proofs use that same block. Changed/missing receipts and uncertain submissions still stop signing. Local integration tests reproduce a backend that returns stale `latest` state and a transient final simulation timeout, then confirm exactly one business signature and transfer.

## Reproduce

```sh
# No signing: replay the original exact calldata at its saved historical blocks.
# Requires installed root dependencies and an archive-capable Sepolia RPC.
node docs/evidence/cli-rpc-2026-10-30/replay-original.mjs

# No public funds: local contract/RPC and failure-path regression suite.
npm test
npm run docs:check
npm run typecheck:cre

# Authorized configured operator only: starts a NEW paid run, up to 0.01 USDC + gas.
npm run --silent demo:agent -- --pay
```

The final full suite passed **219 tests** (44 contracts, 52 SDK, 8 server, 33 CRE and 82 tooling). [Full output](npm-test.log). The earlier documentation checks and CRE typecheck passed; a final documentation check was run again before committing this evidence. Original CRE configs/transcripts are under [success/policy](success/policy); local paths are replaced with `<repo>` and credentials are redacted. SHA-256 hashes are in [manifest.json](manifest.json).

This establishes one successful live local-CRE lifecycle after both fixes. It does not establish the original provider error's exact cause or guarantee RPC/feed availability in a future run. Contract authority is the separate local policy signer; no workflow was deployed to a Chainlink DON. No contract redeployment or policy threshold change was needed. Previously committed recordings and evidence remain unchanged.
