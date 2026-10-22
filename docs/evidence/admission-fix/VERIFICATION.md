# Admission expiry fix — October 22, 2026

The previous paid run stopped with `POLICY_EXPIRED`: one 120-second stream admission was reused across allowance approval and audit receipts. Approval confirmed, but the CLI refused to sign the expired escrow deposit. No USDC moved in that failed run.

The CLI now reruns both CRE price and stream admission checks when setup outlasts a decision's validity. It checks the fresh decision against the same quote, parties, token, amount, duration and session. It retains the anchored, exact transaction spend review and its expiry/fresh-simulation requirements. Validity limits are unchanged. There is no automatic retry of a signed or uncertain transaction.

## Commands and results

```sh
node --test scripts/test/stream-demo.test.mjs
npm run test:tooling
npm run docs:check
npm run --silent demo:agent -- --pay --json
```

- [Final stream regression output](stream-tests.log): 2 tests passed. The local blockchain test injects elapsed time beyond 120 seconds after approval and creation audit authorization, obtains distinct fresh decisions and completes the real contract lifecycle. Renewed denial, recipient substitution and CRE unavailability cause no signing or nonce change. A still-expired renewal fails after one attempt. Audit permissions are stubbed in that timing test; the separate tooling suite tests real local receipt transactions.
- [CLI/tooling suite](tooling-tests.log): 51 tests passed, including the separate audit contract integration. Documentation links, exact SDK examples and historical evidence checks passed.
- [Live CLI output](cli.log) and [host-validated result](result.json): exit 0, run `20261022T094328Z-e57efc79`, Qwen `qwen3.5-plus`, local CRE, Ethereum Sepolia, Circle USDC (6 decimals). The existing exact allowance from the failed run covered this deposit, so no further token approval transaction was needed.
- [Independent RPC verification](rpc-verification.json): successful, confirmed open/close and receipt transactions; inactive stream #3; exact cancellation amounts and final balances; all seven new decision inclusion proofs verified onchain. The original verification command was `node /private/tmp/verify-agentpay-admission-fix.mjs`; a local copy remains at `.local/verify-agentpay-admission-fix.mjs`. It reads the saved run and makes read-only RPC calls; it does not rerun the demo.

## Public transactions

- [Open stream #3](https://sepolia.etherscan.io/tx/0x90436efa218eb077c763807e79f3b709bbb32898fcce7ce5052a2925ac519467): `10000` raw / 0.01 USDC in escrow.
- [Cancel stream #3](https://sepolia.etherscan.io/tx/0xffdd5b3c63e2703e50bb305d868d7577343cdda59883309598dab45fa3b44346): `720` raw / 0.00072 USDC earned; `9280` raw / 0.00928 USDC refunded.
- [Opening audit batch](https://sepolia.etherscan.io/tx/0xd75e36b70b13f9e412f5800cdc1f508280c6c20b63c9ebf165b20c8f9fcaf47f): price, admission and creation spend review.
- [Cancellation audit batch](https://sepolia.etherscan.io/tx/0x0d0e57cef241e6ddbc148ae2f3e277e419677ba73ca7f636a756d2c19c07f841): healthy checkpoint, outage checkpoint and cancellation spend review.
- [Premium denial receipt](https://sepolia.etherscan.io/tx/0x66c8727c9ab7d889494c060e1deeef4dc1fcfd9dbf447702e4087d11f38c0ab5).

Ten successful requests and three explicitly injected failures reused one stream without per-request transactions. The recipient increased from `31080` to `31800` raw USDC; the payer decreased from `39968920` to `39968200`. Two business transactions and three audit transactions consumed test ETH in this successful run. Result receipt arrays include earlier runs; wallet snapshots precede the final audit flush.

## Verification limits

This live run stayed within the admission window, so it did not trigger renewal. Expiry/renewal is demonstrated by the controlled regression test, not claimed as an observed public-chain event. Original per-workflow configurations and transcripts remain in the local run directory named in `cli.log`; this small capture preserves the terminal output and final result rather than copying that entire directory. The saved RPC output is a historical observation, not a CI network check.

CRE was simulated locally. The CLI enforced signing policy; the contract enforced escrow, accrual and cancellation accounting. Audit receipts prove inclusion of recorded hashes, not independent correctness of simulation or DON authentication. Provider content was the demo service, and the outage was deliberately injected. These testnet tokens have no monetary value.
