# Guarded local-CRE stream verification — October 25, 2026

Deployed and exercised `AgentPayGuardedStream` at
[0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09](https://sepolia.etherscan.io/address/0x35f5F69A68D703d70e661b5a0fDe282B3c4dfA09).
[Deployment record](../../deployment/guarded-usdc-stream.json) includes the runtime
hash, dedicated agent, distinct policy signer and distinct recovery owner.
No CRE workflow was deployed to Chainlink's network.

## Actual execution

```sh
npm run --silent demo:agent -- --pay --json
node scripts/verify-guarded-stream.mjs 20261025T173241Z-38db9e1a
```

The first command made real Qwen tool calls and local CRE executions, funded at
most 0.01 Circle Sepolia USDC and signed stream/audit transactions. The second made
independent RPC reads and negative `eth_call` tests, without broadcasting.
The original CLI event stream and all 10 original CRE result/config pairs are
[published with the capture](../../../vite-project/public/runs/20261025T173241Z-38db9e1a/events.ndjson).
The [capture index](../../../vite-project/public/runs/index.json) records its hash
and maps original transcript/config paths to sanitized public artifacts.

| Verified observation | Result |
| --- | --- |
| OPEN signature consumed | nonce 0; [transaction](https://sepolia.etherscan.io/tx/0x08b99ddbe6ddab388dae565832a944d00a8ff688895d4397dbe6414ef7c0db52) |
| Signed session reuse | ten successful API calls; no payment transaction in each request batch |
| Healthy checkpoint | CONTINUE |
| Injected outage | three labeled HTTP 503 responses; CLOSE |
| CLOSE signature consumed | nonce 1; [transaction](https://sepolia.etherscan.io/tx/0x390a9ad36d17f242e8a8a50fbad23ca03859a13e85fac797c2890df1cd7d721d) |
| Escrow conservation | 10000 funded = 1320 earned + 8680 refunded, raw USDC |
| Recipient delta at close block | 33600 → 34920 raw USDC; increase 1320 = 0.00132 USDC |
| Premium request | 0.2 USDC against 0.1 policy cap; DENY without funding |
| Unsigned create/cancel | revert: Policy approval required |
| Agent-forged policy approval | revert: Invalid policy signer |
| Agent invokes recovery | revert: Only recovery owner |

[Independent RPC result](rpc-verification.json) · [OPEN permit](policy-open.json) ·
[CLOSE permit](policy-close.json) · [Signed OPEN evidence](open-evidence.json) ·
[Signed CLOSE evidence](close-evidence.json). Their canonical JSON commitments
match the hashes signed in the permits. Permits are public, expiring signatures rather
than private keys. Both saved signatures were checked against the registered
policy signer and their `PolicyApprovalConsumed` events.

Admission expired during setup confirmations. The CLI obtained fresh price and
stream results before signing, without extending the old result's clock or
repeating a submitted deposit. Accrual and receipt latency explain the payout;
future earned/refund amounts will vary.

## Regression checks

- 44 contract tests, including 12 new signature/escrow/recovery cases.
- 52 SDK tests; eight gateway tests; 32 CRE policy tests.
- 64 CLI/tooling tests, including guarded escrow/session integration, policy
  binding, historical capture projection and the new enforcement marker.
- CRE typecheck, documentation checks, frontend lint and production build.

The first parallel suite hit a disposable legacy RPC startup timeout; that case
passed in isolation, and the startup allowance was increased. Adding the new
capture also exposed a test that selected the newest run while asserting older
fixed payout amounts. That test now pins its historical fixture; a separate case
checks the new guarded capture. The final tooling suite passed all 64 tests.

## Verification limits

The contract authenticates the local policy signer, not DON execution or the
truth of external observations. Policy/recovery files remain on the trusted local
host, outside the model and agent process. A compromised host is outside this
boundary. Recovery-owner closure was tested on a disposable local chain, not
broadcast on Sepolia. The escrow gate does not restrict arbitrary transfers from
the agent's EOA to other destinations. Older captures retain CLI-only enforcement.
