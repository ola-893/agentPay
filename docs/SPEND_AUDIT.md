# CRE spend review, local blobs and onchain receipts

Spend review is a deterministic guardrail around proposed wallet actions. Model reasoning can suggest work, but it cannot substitute for a matching intent, successful transaction dry-run, configured bounds and the CLI’s pre-sign checks. Risk scores are computed by a versioned heuristic, not inferred by an LLM.

AgentPay's streaming CLI now puts a spend-review step before every business transaction it signs: exact token approval, stream creation and cancellation, including legacy recovery cancellation. Guarded `recover:guarded-stream` is an explicit operator override and does not require CRE or an audit receipt. CRE stays local. It calls an RPC simulation API, reads Circle Sepolia USDC state, applies hard rules and a transparent risk heuristic, and sends the complete decision to a durable local blob API. The wallet requires an ALLOW, a verified onchain inclusion receipt and a fresh successful simulation before signing.

**Authority:** the CLI enforces this signing policy. A user holding the private key can bypass the CLI. Legacy AgentPayStream enforces accounting without CRE approvals. AgentPayGuardedStream additionally requires a signed OPEN/CLOSE; it does not itself require the CLI's separate audit receipt or risk review. AgentPayDecisionJournal anchors record hashes; it cannot authorize payments or prove a risk score is correct. These are local-operator receipts, not DON-authenticated reports. No CRE workflow is deployed to Chainlink's network.

## Try the review without making a payment

```sh
npm run --silent demo:spend-review
```

This makes four real local CRE executions against Ethereum Sepolia: an allowed 0.01-USDC transfer intent, an over-cap 0.2-USDC intent, a forbidden zero-recipient call that also reverts in Circle USDC, and a quality-risk block. It simulates those calls but **never signs a payment**. Decisions are saved as local blobs; receipts remain pending until explicitly anchored.

Use the root/CRE dependencies, Bun, authenticated CRE CLI and Node 22. `--json` emits one stdout envelope and progress on stderr. `--help` has no network or credential use. There is no automatic offline fallback. The policy-only execution path used by tests is internal and explicitly labeled `local-policy-test`.

```sh
# Anchor existing pending records only; no CRE rerun or token payment.
npm run --silent demo:spend-review -- --anchor --resume

# Or review four new intents, then anchor them in one batch.
npm run --silent demo:spend-review -- --anchor
```

`--anchor` uses `PRIVATE_KEY_1` (fallback `PRIVATE_KEY`) and Sepolia ETH. Without anchoring, the default public payer is `0xe26468ae02368a75DBDBea58F367B7313942ad26`; override with `AGENTPAY_AUDIT_PAYER`. No key is used for the read-only review. `SEPOLIA_RPC_URL` controls the host simulation API; CRE reads through the Sepolia RPC in `cre/project.yaml`.

The [verified receipt deployment](deployment/decision-journal.json) is `0xa1A5BA33bebdDe7EcA55BDe252568C9D16C4Da87`. The CLI uses that checked-in address unless `AGENTPAY_DECISION_JOURNAL_ADDRESS` is set, and verifies compiled runtime, chain and writer before broadcasting. To use a different writer, compile with `npx hardhat compile`, then deploy its own journal with `npm run deploy:decision-journal`. Existing streams and the strict guard do not need redeployment.

## Existing streaming CLI

`npm run demo:agent` still performs an unsigned admission preview. It now persists the price and stream-policy decisions, including denials, with pending receipts. `npm run demo:agent -- --pay` additionally requires the audit receipt contract and local storage to work. The same requirement applies to legacy `--close-stream <id>`. Current guarded recovery instead uses `recover:guarded-stream`, its separate owner key and ETH, without model/CRE or audit-receipt prerequisites.

Before each business transaction, the CLI reviews the actual ABI calldata. It anchors all pending decisions before signing an allowed transaction, waits two confirmations, verifies the intended decision's Merkle proof against the receipt contract, populates the transaction **after** receipt writes have consumed wallet nonces, and re-simulates immediately before signing. The native gas exposure of each populated business or receipt transaction is capped at 0.01 test ETH. Approval and stream creation are simulated sequentially against actual chain state: creation is reviewed after the approval is confirmed. No fictitious allowance override is used. This is not an atomic multi-transaction simulation or a guarantee of later execution.

Final pre-sign RPC availability failures get at most three read-only attempts, each against a newly observed latest block. The transaction target/calldata/value and reviewed intent remain unchanged. A contract revert, changed block, expired or changed intent, or failed diagnostic write stops signing. The initial observation consumed by CRE also gets at most three availability attempts, all at the **same fixed block** with unchanged calldata. Its last observation is cached for that intent; concurrent requests share the same attempt sequence. Persistent unavailability still returns ERROR. These retries never resubmit a transaction or substitute for a CRE ALLOW and its confirmed receipt.

Receipt verification reads the root, sequence and inclusion proof at the receipt's exact block and checks that block's hash. It also checks the receipt's writer, destination and anchor event. This avoids a false mismatch when a load-balanced RPC's `latest` response lags a confirmed receipt. A changed block, missing proof or uncertain submission still stops signing; reconciliation never rebroadcasts it automatically.

The CLI flushes remaining decisions at completion or during failure handling. A batch can include price-policy blocks, stream-policy decisions and spend reviews. A pre-sign ALLOW must have its receipt confirmed first, so a paid lifecycle can require several receipt transactions. **Receipt gas is separate from approval/open/close gas** and is reported separately. API requests reusing a funded stream do not get another token transaction or another spend review: earnings accrue with time. Cancellation and its audit latency add earned time before mining; already-earned amounts cannot be refunded retroactively.

This boundary covers business transactions signed by `demo:agent` (not separate operator recovery), not every use of its wallet key, legacy tUSD scripts, Qwen/OpenAI API charges, ToolBuyer benchmark-credit calls or third-party applications. ToolBuyer's posterior uncertainty is not automatically imported into a live payment's score. The diagnostic's quality-risk input demonstrates that gate explicitly; live stream reviews default it to zero and retain the separate price and service-health gates.

## Dry-run and risk rules

A spend intent binds chain, payer, exact target/calldata/native value, approved recipients, token, stream, per-intent amount cap, expiry and policy version. The host's simulation API uses `eth_call` and `eth_estimateGas` at an explicit block, preserves successful return data or a sanitized revert/unavailable status, and checks block-hash consistency. CRE retrieves that observation over HTTP and independently reads USDC decimals/balance at the specified block. It validates the observation and evaluates:

- Sepolia, six-decimal Circle USDC, zero native value, supported function selector and exact permitted contract/spender/recipient.
- At most `10000` raw USDC per transfer, approval or deposit; no unlimited approval. This is a per-intent cap, not a rolling daily budget.
- Sufficient token balance for transfers/deposits; nonzero stream rate and a duration no longer than 3600 seconds.
- Successful simulation; token approve/transfer must return ABI `true`. A revert blocks; unavailable simulation errors. Hard rules override a low risk score.
- A five-minute intent expiry. The final CRE version records actual evaluation time; the wallet checks wall-clock expiry again before signing.

For an otherwise eligible call, risk is `5 + 20 if amount exceeds 10% of observed token balance + configured qualityRiskScore`, capped at 100. Scores above 49 block. This is a versioned deterministic heuristic, **not a calibrated probability of loss**, fraud detector or compliance attestation. Quality risk is ignored for cancellation so it cannot obstruct a refund; simulation and audit requirements still apply.

The simulation API, payer policy and blob service are local trusted components. CRE orchestration does not make this RPC observation an independent third-party simulation attestation. Live chain changes, pending transactions, RPC limitations and gas changes can still cause a later transaction to fail. There is no fork trace, arbitrary contract safety analysis or guaranteed estimate of all balance deltas.

## Blob durability and recovery

Storage defaults to `.local/audit/<lowercase-payer>/`; set `AGENTPAY_AUDIT_DIR` to another **local** path. Keep this directory on durable storage and back it up. The loopback API has a random run token and size limits; it is not a hosted multi-user service.

- `intents/`: immutable accepted intents, fsynced before review.
- `blobs/`: canonical JSON decisions addressed by Keccak-256; a changed byte representation cannot silently retain the same content hash.
- `decisions/`: immutable intent-to-blob pointers. Successful commits fsync both blob and pointer before returning.
- `batches/`: Merkle roots, domain-bound leaves, inclusion proofs, receipt hash and submission/confirmation state.
- `execution/`: mutable recovery checkpoints linking a reviewed intent to a submitted/confirmed business transaction or failed review.
- `presign/`: immutable, fsynced final-check attempts, including block/hash, result, RPC operation and sanitized error codes. Raw provider errors and endpoint URLs are omitted. An execution-error blob binds its saved attempts by content hash; successful attempts remain local diagnostics, not additional CRE decisions or separately anchored receipts.
- `simulation/`: immutable initial fixed-block observation attempts. Only the resulting observation is consumed by CRE; these host diagnostics are not additional CRE decisions or separately anchored receipts.
- `runs/`: original local CRE transcripts. Short per-run config files are under `.local/sr/` to satisfy the CLI's path length limit.

Writes use temporary files, fsync, immutable hard-link insertion or atomic rename, and parent-directory fsync. One writer lock prevents concurrent processes from racing the same journal. After a crash, confirm the old process exited before manually removing its stale `writer.lock`; then run `--anchor --resume` to inspect/reconcile. Do not remove a live lock.

Recovery rebuilds a missing pointer from a valid orphan blob. Conflicting orphan decisions or corrupt hashes stop recovery for manual inspection. Accepted intents without a decision become explicit `ERROR / INTERRUPTED_BEFORE_DECISION` records when the controller next starts. A CRE process failure after a blob write cannot turn that ALLOW into an execution permit: the host records a related error and refuses signing. Disk failure can prevent recording anything further; spending then stops, and unresolved accepted intents remain discoverable.

Receipt transactions are signed locally and their hash/outbox is fsynced **before** broadcast. Recovery reconciles a confirmed matching root without resending. An uncertain broadcast is not automatically repeated; inspect its hash and nonce. Previous roots are checked against chain state and a missing/reorganized root stops processing. Business transactions likewise keep their existing no-auto-retry rule. Retain both the blobs and batch proofs; an onchain hash does not guarantee offchain availability or prove that an operator disclosed every wallet action.

The receipt contract binds each leaf to chain, contract, writer, sequence, intent ID and blob hash. It accepts contiguous batches of at most 256 leaves from its configured writer. Sequence numbers order inclusion in the journal; within a flush, pending intent IDs are sorted, so they are not intent-creation timestamps. Every included decision gets a proof. No original policy or receipt blob is rewritten to add its own transaction hash: mutable batch/execution metadata links back to the immutable record.

## Verified evidence and limits

[Receipt deployment](deployment/decision-journal.json) · [all nine blobs, original configurations/logs and proofs](evidence/spend-review/manifest.json) · [independent RPC verification](evidence/spend-review/rpc-verification.json) · [commands and verification limits](evidence/spend-review/VERIFICATION.md).

Two public Sepolia receipts commit nine decisions:

- [First batch: five decisions](https://sepolia.etherscan.io/tx/0x0ce60924b49c8706fb7613b833ecd9c61fcfa6185d44648a74fcfc753047917a), including the existing agent's genuine `FEED_STALE` block. The feed was 86,547s old against the 86,400s limit. No freshness threshold was weakened.
- [Final batch: four CRE spend decisions](https://sepolia.etherscan.io/tx/0xb14e4df637d60e343789f9e8e6b2f6ab74044ba5c4651b8780da3ca648d16d52): ALLOW, over-cap BLOCK, recipient BLOCK with an observed token revert, and risk-score BLOCK. The final records include actual CRE evaluation time; the first exploratory records used intent creation time for evaluation and were never used to execute a payment.

Independent RPC reads checked the deployed runtime/writer, transaction sender/target/calldata, receiver events and all nine inclusion proofs. **No public USDC transfer occurred in these initial audit captures.** The audited streaming path is also tested on a disposable local RPC with a six-decimal token fixture, using real signed approval, stream funding, cancellation/refund and receipt transactions. Those tests cover ERROR records, denied signing, interrupted-intent recovery and uncertain-broadcast reconciliation; they run the shared policy locally and are not presented as live CRE runs.

On October 22, 2026, a [full live Qwen + local CRE run](evidence/admission-fix/VERIFICATION.md) completed against Circle Sepolia USDC: stream #3 funded `10000` raw, served ten requests, returned `CONTINUE`, then `CLOSE` after three injected HTTP 503 failures. Cancellation paid `720` raw and refunded `9280` raw. Three new audit transactions committed seven decisions, including premium denial; independent RPC reads verified all seven inclusion proofs, open/close events, inactive state and exact USDC balances. The journal's eight receipt transactions and 24 decisions in that run's result are cumulative, not costs of that single run. CRE remained local and the CLI signed all transactions.

```sh
npm test
npm run docs:check
npm run typecheck:cre
# Fresh read-only public-chain proof verification:
node scripts/verify-spend-receipts.mjs
```

`docs:check` validates saved blob hashes, original CRE transcript/config hashes, decision calculations and inclusion proofs against saved receipt evidence. It performs no new chain read. The public receiver is audit-only; strict AgentPayGuard/Settlement identity rules remain unchanged and unused.
