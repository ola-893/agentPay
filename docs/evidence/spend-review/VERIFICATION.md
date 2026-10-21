# Spend audit verification

Verified for the October 21, 2026 delivery (Africa/Lagos). The original receipt transactions and CRE captures retain their own timestamps; none are rewritten to appear newer.

- `npm test`: exit 0; 174 tests (32 contract, 52 SDK, 8 gateway, 31 CRE policy and 51 CLI/tooling).
- `node --test scripts/test/spend-audit.test.mjs`: exit 0 after the final gas-cap and recovery changes. A disposable Sepolia-chain-ID Hardhat RPC tested a real signed transfer, approval, stream deposit, cancellation and refund, all with required audit receipts; blocked spending never reached business signing. The policy was run locally for these fixture tests, not via CRE.
- `npm run typecheck:cre`, `npx tsc --noEmit --project demo/tsconfig.json`, frontend lint and build: exit 0. Existing bundle-size and stale Browserslist warnings remain.
- `npm run docs:check`: exit 0; saved blobs/transcripts/configs, decision calculations, Merkle proofs and public receipt snapshot consistency verified without network calls.
- `demo:spend-review`: eight successful real local CRE workflow executions across two runs, each performing HTTP RPC-simulation observations, EVM USDC reads, risk/policy evaluation and HTTP blob persistence. Final four capture actual evaluation time; the first four exploratory captures used creation time and were never used for payment execution.
- `demo:agent -- --json`: exit 1, deliberately blocked by genuine `FEED_STALE` data (86547 seconds, maximum 86400). No business signature or USDC transfer. This block is persisted and included in the first public receipt.
- `deploy:decision-journal`: confirmed two blocks on Sepolia; runtime/writer matched the compiled receipt contract.
- `demo:spend-review -- --anchor --resume`: confirmed one batch of five saved decisions. Final `--anchor` run confirmed a batch of four new decisions. No public USDC transfer occurred in these captures.
- `node scripts/verify-spend-receipts.mjs`: independently fetched both public transactions/receipts, checked sender, target, ABI calldata, events, deployed runtime and writer, and verified all nine inclusion proofs against the receipt contract. Saved in `rpc-verification.json`.

Local tests cover corrupt/changed blobs, immutable conflicts, orphan-pointer repair, accepted intents interrupted before a decision, missing simulations, denied signing, atomic accounting and refund reconciliation, idempotent receipt reconciliation and refusal to resend uncertain broadcasts. Fixture-private keys are public Hardhat test keys connected only to temporary loopback RPCs. No configured private key/API credential was found in the checked-in evidence files.

Receipt anchoring is performed by the local wallet, after CRE has persisted its decision. No workflow was deployed to Chainlink's network and no DON-authenticated onchain authorization is claimed. The receipt contract does not control AgentPayStream. Full live public audited AI stream funding remains unverified because price freshness blocked the attempted preview. Local filesystem durability is not distributed storage availability; backup and retention remain the operator's responsibility.
