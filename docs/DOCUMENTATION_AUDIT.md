# Documentation correctness audit

Scope: the three existing journeys, audited from source at `c1709ef` on 17 October 2026. No product feature or public deployment is part of this audit. This matrix was written before changing the guides; verification results below will distinguish observations from remaining operator steps.

## Claim-to-evidence matrix

| Consequential claim | Raw implementation / original evidence | Assessment before rewriting |
| --- | --- | --- |
| Existing CRE captures can be viewed without a wallet or CRE login | `CREWorkflow.jsx`, `lib/evidence.mjs`, `public/evidence/cre-*.json` | Supported by static fetch path; recheck both scenarios and error recovery in browser. |
| Saved ALLOW/DENY came from successful CLI runs | `docs/evidence/cre-*.log`, matching JSON, `scripts/lib/cre-evidence.mjs` | Original transcripts exist. Existing link check does not compare log hashes, returned results, public copies or report fields; add those checks. |
| Live reproduction is read-only and can fail with changing inputs | `simulate-cre.mjs`, `preflight-cre.mjs`, `main.ts`, `policy.ts` | Supported: wrapper forces preview, validates expected reason and exits on failure. Requires installed Bun/CRE, account access, HTTP/RPC access. A clean checkout does not provide CRE credentials. |
| 0.01 USDC is 10000 units; policy cap is 100000 | `config.staging.json`, `main.ts` ABI encoding, `GuardedPaymentClient.pay` | Supported. Clarify that the report's maximum is the requested **10000**, not the policy cap of **100000**. |
| Price agreement alone cannot approve a depeg | `policy.ts evaluate`, `policy.test.ts` | Supported by independent peg bounds. Feed age up to 86400 seconds is allowed; no immediate-depeg-detection guarantee. |
| A report authorizes one positive payment up to its maximum | `AgentPayGuard.canPay/consume`, `AgentPaySettlement.settle` | Source supports it. Existing tests reject overspending/reuse and roll back failed transfers; add a behavioral test for partial consumption and zero amount. |
| SDK checks chain/binding/authority before approving | `GuardedPaymentClient.ts`, `guarded-payment.test.ts` | Supported by mocked SDK tests, separately from local contract tests. No test of actual production DON delivery or Circle token settlement. |
| Documented root-level TypeScript examples work with a real ethers signer | SDK and root lockfiles, module resolution, frontend generated snippet | Incomplete: examples omit signer construction and root/SDK ethers installations can have incompatible private types. Compile exact text with real dependency types; do not conceal the issue with casts or a synthetic SDK-derived signer type. |
| Agent setup only saves a local non-secret draft | `AgentConsolePage.jsx` validation/save/reset/code generation | Supported by source. Verify invalid input, exact integer code generation and reload/reset in browser. It performs no deployment or contract identity lookup. |
| Legacy stream setup uses separate 18-decimal tUSD | `WalletContext.jsx`, `CreateStreamForm.jsx`, `AgentPaySDK.ts`, deployment scripts | Supported. Requires a real stream/token deployment and wallet for public transactions; unavailable here. |
| Ended active streams release the full unwithdrawn remainder | `AgentPayStream.getClaimableBalance`, UI accounting helper | Source and UI unit test support it; add a local contract test including prior withdrawal and division dust. |
| Legacy gateway proves payment/identity | Middleware, SDK negotiation and server route configuration | Only stream recipient/time/rate/status checks exist. Stream IDs are public and no payer-session authentication exists. Current docs correctly limit the claim; default per-request server route is incompatible with streaming negotiation. |
| Missing production prerequisites can be replaced by a simulated receipt | Guard, isolated simulation receiver and write-runner source | Unsupported. Strict identity is required; mock receiver is record-only. No public receiver deployment or verified receipt is present. Keep these as explicit unexecuted operator procedures. |

## Verification record

Pending: clean-checkout installation and command output, exact-snippet compilation, evidence-integrity checks, contract boundary checks and browser walkthroughs. Historical CRE transcripts remain historical evidence; this audit will not relabel them as newly executed runs.
