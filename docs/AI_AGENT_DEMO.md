# AI agent with deterministic CRE payment guardrails

The agent proposes work. Local CRE checks fixed rules. A separate policy process
signs eligible OPEN/CLOSE actions. **AgentPayGuardedStream verifies those approvals
before the agent can fund or close escrow.** Many authenticated API requests reuse
one time-based stream; earnings accrue without a payment transaction for each call.

Current escrow: [`0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09`](https://sepolia.etherscan.io/address/0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09).
[Deployment record](deployment/guarded-usdc-stream.json) · [Authority and contract details](GUARDED_STREAMS.md).
The contract authenticates the local operator's policy signature, not DON execution.

## Choose a journey

| Journey | Prerequisites / behavior |
| --- | --- |
| Recorded Workflow replay | Node 22 and frontend dependencies; no keys or CRE login; historical evidence only |
| Standalone `cre:simulate` | Bun, CRE dependencies, CRE account/login and external connectivity; no wallet key or funds |
| `demo:agent` preview | Real funded model key, registered payer key for identity/session setup, registered recipient/escrow, RPC, local policy key, CRE and local audit storage; no transaction signing |
| `demo:agent -- --pay` | Preview prerequisites plus payer test USDC/ETH, working audit receipt contract; creates a new stream |
| Guarded operator recovery | Separate recovery key, RPC, recorded guarded deployment and recovery-owner Sepolia ETH; no model or CRE required |

An arbitrary new wallet cannot use the checked-in escrow: its registered agent,
policy signer and recovery owner are fixed. A clean checkout can replay all public
evidence but does not contain the operator's keys. The deployment helper refuses
an existing deployment record; follow [the operator limitations](GUARDED_STREAMS.md#deploy-and-run)
before preparing an independent deployment. Do not publish or request someone else's keys.

## Configure an authorized local operator run

Use Node 22+, installed root dependencies, Bun, CRE dependencies and working
`cre login`. Compile missing artifacts with `npx hardhat compile`. Put credentials
only in ignored root `.env`:

```dotenv
QWEN_API_KEY=<funded-key>
AGENTPAY_AI_PROVIDER=qwen
QWEN_MODEL=qwen3.5-plus
QWEN_REGION=singapore
PRIVATE_KEY_1=<registered-Sepolia-agent-key>
AGENTPAY_AGENT_RECIPIENT=<registered-recipient-address>
AGENTPAY_USDC_STREAM_ADDRESS=0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

The registered public parties are in [the deployment record](deployment/guarded-usdc-stream.json)
and [profile](../demo/agents/treasury-research.json). The policy key is in ignored
`.local/policy/policy-key.json` (0600); it is read by the separate policy process,
not passed to the model or agent process. The recovery key is separate again.
These processes share a trusted host account; this is not OS isolation against a
compromised host. Back up operator keys privately.

For OpenAI, set `AGENTPAY_AI_PROVIDER=openai`, `OPENAI_API_KEY` and optionally
`OPENAI_MODEL` (default `gpt-4.1-mini`). `OPEN_AI_KEY` is an alias. Qwen defaults to
Singapore; `QWEN_REGION` also accepts `virginia` and `beijing`. Optional
`QWEN_BASE_URL` must be an official Model Studio HTTPS endpoint ending
`/compatible-mode/v1`. Without an explicit provider, a Qwen key selects Qwen,
otherwise OpenAI. No provider or heuristic fallback occurs.

`PRIVATE_KEY` is a fallback for `PRIVATE_KEY_1`;
`CRE_PAYMENT_RECIPIENT_ADDRESS` aliases the recipient. Primary values take
precedence. Never put secrets in browser fields or `VITE_` variables. Model calls
may incur API charges. Obtain test USDC from [Circle's faucet](https://faucet.circle.com/)
with Ethereum Sepolia selected. Testnet tokens have no monetary value.

## Preview and paid demo

```sh
npm run --silent demo:agent
npm run --silent demo:agent -- --pay
```

Preview makes real model, CRE, HTTP and chain calls, records admission/denial blobs
and leaves audit receipts pending. It does not approve tokens, fund escrow, unlock
paid content or invent funded checkpoints. Paid mode deposits at most **0.01 USDC**
plus test ETH for approval/open/close and audit receipts. It requires working
[durable audit storage and journal](SPEND_AUDIT.md), and refuses legacy unguarded escrow.

1. Qwen/OpenAI proposes basic and premium tiers through actual tool calls. The
   model supplies tier/purpose; it cannot change quote amounts, recipient, rate or policy.
2. The provider returns a bound HTTP 402 streaming quote. Basic is `10000` raw USDC
   over **1000 seconds** (`10` raw/s). Premium is `200000` against a `100000` policy cap.
3. The separate policy process executes local CRE: Coinbase and finalized Chainlink
   USDC/USD price safety, then HTTP health/counter agreement and Sepolia token/balance
   reads. Eligible basic admission returns OPEN; the oversized premium proposal is DENY.
4. The CLI obtains allowance if needed. The policy process signs a short-lived
   OPEN permit from its own validated CRE evidence. The CLI reviews the exact
   transaction, persists/anchors its audit decision, then submits it. The contract
   checks signature, caller, intent, nonce, expiry, session and hard limits before funding.
5. The payer signs service access bound to origin, chain, quote, escrow, stream and
   payer. The provider verifies that session and onchain stream state.
6. Five calls reuse the stream; CRE returns CONTINUE at the healthy checkpoint;
   five more calls reuse it. Nonce observations establish no payment transactions
   within each request batch. CONTINUE itself is a local checkpoint, not an onchain write.
7. The demo injects three labeled HTTP 503 failures. CRE returns
   CLOSE / SERVICE_UNAVAILABLE. The policy process signs CLOSE; the CLI audits
   cancellation; the contract checks the permit, pays unwithdrawn earnings and refunds unused escrow.
8. Receipt/event/state and wallet-balance checks establish
   `earned + refunded = deposit`, and the closed stream no longer unlocks service.
   Model summaries remain unverified prose; host totals are authoritative evidence.

Admission lasts 120 seconds. If setup confirmations outlive it, the CLI obtains new
price/admission checks without extending old validity or repeating a submitted
transaction. A signed permit lasts five minutes; expiry during later review stops
execution rather than bypassing the contract. Funding is not automatically retried
on uncertain confirmation. Inspect hashes before another paid run.

The final pre-sign check retries RPC availability failures at most three times,
using read-only calls and unchanged transaction data. A contract revert or expired
intent stops signing. Inspect `PRESIGN_*` errors and the diagnostic path printed
by the CLI; [troubleshooting](reference/troubleshooting.md#ai-cli-demo) explains
the distinction from an uncertain submitted transaction.

Earnings are time-based, not a charge per request. Accrual continues until closure
is mined, including observation, CRE and receipt latency. Expiry bounds earnings
but does not automatically execute a refund. Recipient withdrawals remain available.

## Output and evidence

Default output follows numbered stages: agent request, CRE price/admission checks,
spend dry-run and risk score, funding, stream reuse, outage protection, closure/refund
and budget denial. It shows USDC amounts, live oracle prices, feed freshness, policy
limits and observed Sepolia blocks. Signed transactions are marked as waiting;
funding and closure are confirmed only after the checks succeed. Audit receipt
transactions are reported separately from stream transactions.

For a live presentation, use `npm run --silent demo:agent -- --pay` in a terminal
around 80–100 columns wide with a readable font. Color and elapsed-time spinners
appear automatically in an interactive terminal. Redirected output, `NO_COLOR`,
`TERM=dumb`, JSON and event streams use stable text without animation. Each paid
invocation starts a new stream and spends gas.

Use `--verbose` for full CRE commands, config/transcript paths, raw units, addresses,
evidence hashes, model IDs and unverified model prose. Those original artifacts
remain saved in either mode. Local policy signatures are identified separately
from DON authentication. `--json` emits one result envelope on stdout and progress
on stderr; `--events ndjson` emits public versioned events. No secret or signed
transaction payload is saved.

A pre-execution organization-lookup failure gets one retry with unchanged inputs;
invalid credentials, compilation/execution failures and policy results do not.
Completed failed authentication attempts are retained as sibling `*.attempt-N.log`
files. If both account lookups fail, `CRE_ACCOUNT_UNAVAILABLE` reports `cre whoami`
and conditional `cre login` instructions with the exact transcript path. Named
CLI errors survive the separate policy-process boundary. [Troubleshooting](reference/troubleshooting.md#ai-cli-demo).

Each `.local/agent-demo/runs/<id>/` contains original `policy/` CRE evidence,
`policy-open.json` / `policy-close.json` public permits, transaction journals,
`settlement.json`, model events and either `result.json` or `failure.json`.
`settlement.json` describes escrow cancellation, not AgentPaySettlement.

CLI admission-denial and final-balance checks read both USDC balances and the
confirmed nonce at one block, verify its hash and never read behind an already
confirmed business/audit transaction. `deny-verification.json` saves both block
references and snapshots before comparing wallet state. These checks do not attest
to third-party pending transactions in a mempool.

**Successful guarded run, October 25:** stream #1 funded 0.01 USDC, served ten calls,
continued, closed after the injected outage, paid **0.00132 USDC** and refunded
**0.00868 USDC**. [Verification](evidence/guarded-stream/VERIFICATION.md).
A later same-day retest failed CRE authentication after five calls; the separate
operator closed stream #2, paying **0.00216 USDC** and refunding **0.00784 USDC**.
[Failure and recovery evidence](evidence/guarded-retest/VERIFICATION.md).
Neither capture promises future availability or constant payout amounts.

**Successful guarded retest, October 30:** stream #5 served ten calls, passed
CONTINUE and closed after the injected outage, paying **0.0012 USDC** and
refunding **0.0088 USDC**. Both policy signatures and seven decision proofs across
three new audit receipts were verified against Sepolia. The same evidence records
the earlier RPC failures and their fixes: [verification and reproduction](evidence/cli-rpc-2026-10-30/VERIFICATION.md).

## Recover an interrupted guarded stream

Ctrl+C (`SIGINT`) or `SIGTERM` requests shutdown at the next safe boundary. The
runner waits for any submitted transaction to resolve, then checks the exact
funded stream through local CRE with `phase: shutdown`. A matching active stream
returns `CLOSE / CLIENT_SHUTDOWN`; the separate policy process signs it and the
usual audited cancellation settles earnings and refunds unused escrow. This does
not invent a service outage. The command still exits 130 or 143, with cleanup
recorded in `failure.json`. Ordinary failures use the same signed cleanup path.

An unavailable signer/CRE, mismatched stream, uncertain transaction or hard kill
can still require manual recovery. Inspect `open.json`, `close.json` and public
hashes first. For an active guarded stream, use the separate **operator** command:

```sh
npm run --silent recover:guarded-stream -- --stream-id 2
```

Replace `2` with the actual active ID. It reads the recovery-owner key, requires
ETH on that owner and closes without CRE/model or a spend-audit receipt. It checks
closure and payout conservation. The agent cannot use this authority. If CRE fails
mid-run, normal closure may be unavailable; the CLI reports operator recovery
instead of creating a fake CLOSE permit. Already-mined earnings cannot be recovered.

`demo:agent -- --close-stream <id>` is **legacy** recovery only, requiring its old
wallet/CRE/audit settings. Against a guarded deployment it exits with operator
recovery instructions. It does not provide a guarded bypass.

## Verification and boundaries

```sh
npm test
npm run docs:check
npm run typecheck:cre
```

Contract/local-RPC tests cover signature binding, expiry, replay, duplicate active
funding, recipient withdrawal, separate recovery and exact refunds. Saved public
RPC evidence is distinct from those fixtures. The gate protects this escrow; it
does not restrict unrelated transfers from the agent's EOA. HTTP counters run under
one operator and do not prove answer quality. The protocol is AgentPay-specific
HTTP 402/session access, not full x402. Two confirmations are not finality; price
reads are finalized. CRE remains local and the strict DON consumer is unused.

Historical [unguarded stream](evidence/stream-demo/VERIFICATION.md) and
[direct-transfer](evidence/agent-demo/VERIFICATION.md) evidence remains unchanged.
[Guarded source](../contracts/AgentPayGuardedStream.sol) · [Workflow](WORKFLOW.md).

Latest [October 29 live readiness verification](evidence/readiness-2026-10-29/VERIFICATION.md) covers the completed lifecycle, deliberate SIGINT shutdown, independent receipt reconciliation and local hard-stop recovery tests.
