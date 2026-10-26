# Documentation correctness audit

**Historical audit of October 17, 2026.** Its command inventory, counts, routes and verification limits describe that revision, not current setup. Use [the current reliability audit](RELIABILITY_AUDIT.md), [CLI guide](AI_AGENT_DEMO.md) and [guarded deployment](GUARDED_STREAMS.md) for current behavior.

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
| Any failed capture leaves all previous files intact | `simulate-cre.mjs`: validation, backup, then three sequential writes | Too broad. CLI/decision failure precedes replacement, but interrupted filesystem writes can leave mixed copies. Correct the guides and require backup restoration plus integrity checks. |
| The risk-policy card reports a passing budget check in each scenario | Browser DENY view, `CREWorkflow.jsx` static list text | Contradiction: “Payment within its cap” also appeared under DENY. Changed the explanatory copy to “Amount checked against per-request cap”; the decision/result is unchanged. |

## Verification record

The corrected implementation/docs were committed as `d11d6d0`. A disposable clone of the repository was fast-forwarded to that commit and had no tracked or untracked changes before verification. It used no `.env` or frontend deployment configuration. It did share this host's installed tools, package/compiler caches and pre-existing CRE login; this is a clean checkout, not a fresh-machine bootstrap test.

| Verification | Observed result / reproducible evidence |
| --- | --- |
| Installation | `npm ci` in root, SDK, server and frontend; `bun install --frozen-lockfile --cwd cre/payment-guard` succeeded. The exact convenience command `npm run install:all` also succeeded; it changed SDK/server lockfile indentation only (parsed JSON identical). Those disposable copies were restored before verification. Registry access required leaving the restricted sandbox. |
| Tools | Node 22.23.2, npm 10.9.8, Bun 1.3.12, CRE CLI 1.37.0. A host runtime launch initially failed with a missing Homebrew library; explicitly selecting installed Node 22 resolved it. No project dependency change was needed. |
| Documented local checks | All six commands exited 0: [summary](evidence/documentation-audit/summary.json), [docs](evidence/documentation-audit/1-docs-check.log), [tests](evidence/documentation-audit/2-test.log), [SDK build](evidence/documentation-audit/3-build-sdk.log), [CRE typecheck](evidence/documentation-audit/4-typecheck-cre.log), [web build](evidence/documentation-audit/5-build-web.log), [lint](evidence/documentation-audit/6-lint.log). |
| Behavior | 111 tests: 29 contract, 49 SDK, 8 gateway, 11 CRE policy, 14 tooling. New [contract cases](../test/DocumentationGuarantees.test.js) verify zero rejection, partial single-use settlement and ended-stream rounding after prior withdrawal. SDK HTTP/contract mocks are separate from local Solidity execution. |
| Frontend startup | The exact `npm run dev` command started Vite 7.1.1 in 152 ms from the clean checkout; stopped afterward. [Startup output, terminal control codes removed](evidence/documentation-audit/startup.log). |
| Exact examples | Eleven repository/frontend/generated fragments compile against installed SDK and ethers types. Imports remain module-level; bodies are placed inside an async function, with external signer/contract/config prerequisites explicitly declared. The guarded reference also constructs a real ethers `Wallet` type. No casts hide incompatible signer types. Nothing is executed. Dynamic `ethers.Contract` calls do not provide ABI argument checking through TypeScript. |
| Broken root signer example | Reproduced TS2345 for a root-imported ethers wallet passed to the SDK: `Network` private fields belong to separate installations. Fixed the documented file location/imports to use `sdk/` and `./src`. Dependency consolidation for arbitrary consuming apps remains their integration prerequisite. |
| Integrity and failure checks | Both historical transcript hashes, successful result objects, config hashes, public JSON copies and all nine decoded ABI fields match. [Deliberately altered transcript and wrong amount type](evidence/documentation-audit/negative-checks.json) both fail the new checks. These are consistency checks, not cryptographic report authentication. |
| Initial live dry run | [Summary](evidence/documentation-audit/initial-dry-run/summary.json): ALLOW failed credential validation; budget DENY succeeded. The overall dry run correctly exited 1. [ALLOW log](evidence/documentation-audit/initial-dry-run/allow.log), [DENY log](evidence/documentation-audit/initial-dry-run/deny-budget.log). |
| Retry live dry run | [Summary](evidence/documentation-audit/retry-dry-run/summary.json): both real npm scenarios succeeded. ALLOW headroom 85304 seconds; budget DENY 85295 seconds, computed using CRE's observation clock. [ALLOW log](evidence/documentation-audit/retry-dry-run/allow.log), [DENY log](evidence/documentation-audit/retry-dry-run/deny-budget.log). No broadcast or dashboard recapture occurred. |
| Browser journeys | Verified both saved decisions/units/commands; missing-evidence error and Retry recovery; invalid addresses and seven-decimal USDC rejection; draft save/reload/reset; generated `10000n`; exact clipboard equality; stream setup without a wallet; corrected integration guide. [Guide DOM](evidence/documentation-audit/integration-dom.txt), [screenshot](evidence/documentation-audit/integration.jpg). Test fixture draft was reset afterward. |

## Reproduce the audit

From a checkout with the committed lockfiles installed and the tools above:

```sh
npm run docs:check
npm test
npm run build:sdk
npm run typecheck:cre
npm run build:web
npm --prefix vite-project run lint
# Requires your existing CRE account/login and reachable live services:
npm run cre:dry-run
```

The [CI workflow](../.github/workflows/ci.yml) runs the six credential-free verification commands after locked installs. The two live scenarios require external services and cannot be promised to return the same decision later. Kept transcripts record both the failure and retry, rather than hiding the service prerequisite.

## Explicit limits

- No production DON deployment, verified public consumer receipt, actual Circle USDC transfer, browser-wallet signing, or public tUSD transaction was exercised. [Deployment](../DEPLOYMENT.md) remains an operator procedure requiring access, addresses and funded dedicated test wallets. A clean checkout alone cannot complete guarded settlement.
- The UI walkthrough used the working tree corresponding to `d11d6d0`; it was not a connected-wallet end-to-end test. Files temporarily removed for recovery testing were restored, and historical dashboard captures were checked afterward.
- Capture/config hashes detect accidental drift; anyone editing all evidence and hashes can fabricate consistent files. They do not prove DON signatures, ownership or payment. No independent developer onboarding session was performed.
- Original source metadata is in [the USDC verification snapshot](evidence/usdc-source-verification.json). Live simulations re-read token/feed properties. The audit also checked the official [Chainlink consumer metadata/simulation guidance](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts). It did not refresh the full feed-directory snapshot.
- Existing build/test warnings include bundle size, Browserslist data and SDK test module detection. `install:all`'s npm audit reported dependency advisories (including critical findings in root/server). No dependency remediation or security audit was performed; passing the documented commands is not a security certification.
