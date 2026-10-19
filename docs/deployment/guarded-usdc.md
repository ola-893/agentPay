# Sepolia guarded USDC deployment

The strict guard and settlement contracts were deployed and connected on October 19, 2026. **The CRE workflow is not deployed, and no USDC payment has been authorized or settled.** The CRE organization does not yet have deployment access. The CLI submitted an access request instead of deploying; its zero exit status is not deployment evidence.

| Component | Current status |
| --- | --- |
| AgentPayGuard | [0xf07af10A7Af5D3d6E5beF3B3f22195a89C257770](https://sepolia.etherscan.io/address/0xf07af10A7Af5D3d6E5beF3B3f22195a89C257770) |
| AgentPaySettlement | [0x8DB1bc06b9e448c8bB3fC95f12da55Da1e1f631A](https://sepolia.etherscan.io/address/0x8DB1bc06b9e448c8bB3fC95f12da55Da1e1f631A) |
| Trusted Sepolia forwarder | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, confirmed by tenant-scoped `cre workflow supported-chains` and the official directory |
| Workflow identity | Zero; reporting remains closed |
| Live target | `sepolia-live`, using the CRE private registry; configured and compiled, not registered |
| Payer | `0xe26468ae02368a75DBDBea58F367B7313942ad26`; observed balance 40 Circle test USDC |
| Test recipient | `0x9950D8950BF80722860f2B6a9e120893a0fE79f7`; observed balance 0 USDC |
| Payment intent | `10000` raw units = 0.01 USDC, cap `100000` = 0.1 USDC |

The [deployment record](sepolia-guard.json) contains successful deployment/binding receipts, runtime hashes, balances and request ID. Runtime code matched the compiled contracts after masking compiler-declared immutable slots; owner, forwarder and reciprocal guard/settlement bindings were checked separately. This is bytecode comparison against local artifacts, not explorer source verification or a security audit.

The [live configuration](../../cre/payment-guard/config.sepolia.json) contains real public addresses and `publishReport: true`. The original `staging-settings` target remains read-only with its historical captures unchanged. The dedicated recipient wallet was generated locally; its key is retained only in ignored `.local/cre/usdc-recipient-wallet.json`. Never publish that file. The locally configured deployment wallet remains the payer; no keys belong in workflow config or frontend variables.

## Verification completed

- [CRE WASM build output](../evidence/guard-deployment/cre-build.log).
- [Actual deployment attempt](../evidence/guard-deployment/cre-deploy.log): access not enabled, request submitted, no workflow ID returned.
- [Public Sepolia negative payment test](../evidence/guard-deployment/payment-not-authorized.json): the real SDK rejected payment before approval because authorization was absent. Payer/recipient balances, allowance and wallet nonce were unchanged; no payment transaction was sent.
- Two read-only simulations using the real addresses compiled but failed when Coinbase exceeded the 10-second HTTP deadline: [first attempt](../evidence/guard-deployment/preview-first-attempt.log), [second attempt](../evidence/guard-deployment/preview-second-attempt.log), [exact preview config](../evidence/guard-deployment/preview-config.json). The preview disabled publication; policy thresholds were unchanged. Neither attempt establishes a fresh ALLOW. Earlier successful staging evidence remains historical and was not replaced. Recheck API availability before the positive test; deploying to a DON does not establish that the endpoint will respond successfully there.

Reproduce the negative test while the guard still has a zero workflow ID:

```sh
npm run build:sdk
node docs/testing/check-guarded-payment.cjs
```

This test requires the local payer key in root `.env` and public Sepolia RPC access. It intentionally stops if the guard has subsequently been configured or the request has been reported. It cannot establish successful payment behavior.

## Resume after CRE approves deployment access

1. Run `cre whoami` and confirm `Deploy Access: Enabled`. Do not repeatedly call `cre account access`: the installed CLI can submit another request even with `--non-interactive`.
2. From `cre/`, deploy the prepared target:

   ```sh
   cre workflow deploy payment-guard --target sepolia-live --yes --non-interactive
   cre workflow get payment-guard --target sepolia-live
   ```

   Confirm registration and retain the **actual returned workflow ID**, configuration/binary hashes and status. Private-registry management uses the CRE login session and does not require Ethereum mainnet funds. The workflow activates immediately after registration.

3. From the repository root, run `npx hardhat console --network sepolia`. After replacing the placeholder with that deployed workflow ID:

   ```js
   const guard = await ethers.getContractAt('AgentPayGuard', '0xf07af10A7Af5D3d6E5beF3B3f22195a89C257770');
   const binding = await guard.setWorkflowId('0x<actual-32-byte-deployed-workflow-id>');
   await binding.wait();
   await guard.workflowId();
   ```

   Keep the strict forwarder and identity checks enabled. A simulator's mock report cannot authenticate this workflow. A precomputed hash alone is not proof that a workflow was registered or executed.

4. Wait for the cron execution to deliver a fresh ALLOW report. Verify a successful forwarder transaction, the guard's `DecisionReceived` event for the exact configured request, its decision tuple and `canPay` result. A CLI ALLOW or `reportWriteSucceeded` field alone is insufficient. The current authorization lasts 300 seconds; a missing, denied or expired report must stop payment.
5. Use [GuardedPaymentClient](../sdk/guarded-payment-client.md) with the funded payer, deployed guard/settlement addresses, this request ID and `10000n`. Snapshot both Circle USDC balances before calling `pay`; retain the successful settlement receipt, matching `PaymentSettled` and USDC `Transfer` events, consumed authorization and balances afterward. Require the recipient's increase to be exactly `10000` raw units and the payer's decrease to match. Do not treat the earlier negative test as this positive test.
6. Pause the workflow from `cre/` after its first accepted report; this can be done before settlement to prevent repeated cron executions:

   ```sh
   cre workflow pause payment-guard --target sepolia-live --yes --non-interactive
   ```

The prepared workflow is a **single payment intent**, checked every five minutes. The guard rejects repeats of its request ID, including after expiry or payment; this target is not a reusable payment queue. Pause after the first accepted report, then settle before expiry. A later intent needs a fresh request ID, updated workflow deployment and corresponding workflow-ID binding. If the first report expires before settlement, do not reuse it or weaken expiry checks.

Deployment access approval and the positive payment test remain outstanding. The locally tested signature/identity logic, a funded wallet and deployed contracts do not substitute for a DON-delivered report.

## Official references

- [CRE deployment access](https://docs.chain.link/cre/account/deploy-access)
- [Private registry deployment](https://docs.chain.link/cre/guides/operations/deploying-to-private-registry-ts)
- [Tenant forwarders and directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts)
- [Consumer authentication and simulation limitations](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts)
