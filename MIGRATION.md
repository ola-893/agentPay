# Repository migration

On 16 October 2026, the tracked contents of `ola-893/flowpay` were imported into
`ola-893/agentPay` as 19 focused commits, followed by this provenance record.

- Source: [ola-893/flowpay](https://github.com/ola-893/flowpay)
- Source branch: `main`
- Source revision: [`de41ae887a5679942fe67796220fabe029d35f2e`](https://github.com/ola-893/flowpay/commit/de41ae887a5679942fe67796220fabe029d35f2e)
- Source tree: `a453f383322a4a3bfeecd8c9dc9068928b32aa14`
- Exact imported tree: [`a29a3719470489f07e1eb5d4e7c73e497752a1db`](https://github.com/ola-893/agentPay/commit/a29a3719470489f07e1eb5d4e7c73e497752a1db)
- Original tracked files: **109**

All original tracked files retain their exact bytes, Git blob IDs, and file modes.
The tree at the final source import commit is identical to the source tree.
The only additional files in the completed migration are this document and
[`docs/migration-source.json`](docs/migration-source.json).
No source files, dependency versions, product names, or existing links were rewritten.
The original LICENSE is preserved.

## How to read the history

These commits organize an existing snapshot by subsystem and feature. They are
import boundaries, not a recreation of the original development sequence.
They use the migration-time author, committer, and timestamps. Each import
commit includes `Source-Repository` and `Source-Commit` trailers. The original
development history remains in the source repository; it is not an ancestor
of this repository's new `main` branch.

Dependencies and supporting components precede their consumers where practical.
The frontend entry point and routing are assembled in commit 14 after the
supporting features. The complete application and all original project scripts
are present at the final source import commit. Intermediate imports are partial
project snapshots; this migration does not claim that every project-wide command
passes at each intermediate commit.

| Order | Commit | Scope |
| --- | --- | --- |
| 1 | [`18cb27ec`](https://github.com/ola-893/agentPay/commit/18cb27eccee8a571e5a79b5b14192b9e6cfb85ba) | chore: import project dependencies and environment template |
| 2 | [`b1d19dbc`](https://github.com/ola-893/agentPay/commit/b1d19dbca7a87475b1c8c299648415d4e20ea1ed) | feat(contracts): import token streaming contracts and tests |
| 3 | [`7ee84f8e`](https://github.com/ola-893/agentPay/commit/7ee84f8ef3d35603174421cc30300d73e94b9ea2) | feat(sdk): import payment negotiation and spending controls |
| 4 | [`7e009459`](https://github.com/ola-893/agentPay/commit/7e009459e5d655d3f1148a68c5b4babce8256566) | feat(sdk): import service proxy and mesh coverage |
| 5 | [`ead2ac13`](https://github.com/ola-893/agentPay/commit/ead2ac1335595f07754c79936bb4aa867e1a74a3) | feat(server): import x402 middleware and example API |
| 6 | [`4cfcd5da`](https://github.com/ola-893/agentPay/commit/4cfcd5da5cba2e3ec547a0240e68975a088be87a) | feat(demo): import provider and consumer payment walkthrough |
| 7 | [`c622287c`](https://github.com/ola-893/agentPay/commit/c622287c773a2c5b5ca75258c13fbb4798d3d096) | chore(web): import frontend tooling and visual foundation |
| 8 | [`f64e0730`](https://github.com/ola-893/agentPay/commit/f64e073028ff2badbb9466d951b05fceb6d3c4dd) | feat(web): import shared feedback and responsive UI |
| 9 | [`facd3893`](https://github.com/ola-893/agentPay/commit/facd3893ed6de5c5ea0bafa76cf1b2a57acab083) | feat(web): import wallet state and contract bindings |
| 10 | [`f3431314`](https://github.com/ola-893/agentPay/commit/f3431314f302393e91f78883421a85fc714a33e9) | feat(web): import stream creation and management screens |
| 11 | [`a132d07f`](https://github.com/ola-893/agentPay/commit/a132d07fecfa488a4bbbe24301c2ce41c302c801) | feat(web): import agent console and decision log |
| 12 | [`73bd5c04`](https://github.com/ola-893/agentPay/commit/73bd5c04de4d03787334b709a22c681cdd39d292) | feat(web): import stream monitoring and payment analytics |
| 13 | [`e64553b0`](https://github.com/ola-893/agentPay/commit/e64553b006b05b3e7d342cf61d9662580a1eb282) | feat(web): import in-app documentation browser |
| 14 | [`05733736`](https://github.com/ola-893/agentPay/commit/05733736ffe1b23f315033baebe077f7cf418c6a) | feat(web): assemble application navigation and routes |
| 15 | [`ecebb3ba`](https://github.com/ola-893/agentPay/commit/ecebb3baa64c3cd1730a232c655fbd0601290488) | docs: import local setup and configuration guides |
| 16 | [`658a2c3b`](https://github.com/ola-893/agentPay/commit/658a2c3bfc5a97960d2abac9ac57e872c1184446) | docs: import protocol architecture and contract reference |
| 17 | [`8416a558`](https://github.com/ola-893/agentPay/commit/8416a5588506c401ef61c0808f719c5765aa9fa8) | docs: import SDK reference and frequently asked questions |
| 18 | [`8466b39c`](https://github.com/ola-893/agentPay/commit/8466b39c4f052f79ace3ef1f78e56973f434c4e1) | docs: import deployment guides and project overview |
| 19 | [`a29a3719`](https://github.com/ola-893/agentPay/commit/a29a3719470489f07e1eb5d4e7c73e497752a1db) | docs(specs): import original requirements and design records |

The machine-readable manifest maps every original file to its source Git blob,
file mode, and introducing import commit. Future fixes can be made as separate
commits against this baseline.

## Verification

The import was checked by comparing the complete Git tree IDs before adding this
record, comparing each file's bytes, confirming all 109 paths were assigned
exactly once, and running `git fsck --full`.

Checks ran with Node.js 22.23.2 and npm 10.9.8. All four packages installed
successfully from their existing lockfiles using `npm ci --ignore-scripts`.
The commands below describe the equivalent package-local checks; the SDK build
output was directed to a temporary directory to keep generated files out of Git.

| Check | Command | Result |
| --- | --- | --- |
| Contracts | `npx hardhat test test/FlowPayStream.test.js` | 6 passing |
| SDK tests | In `sdk`: `npx mocha --exit -r ts-node/register 'test/*.test.ts'` | 41 passing |
| Server middleware tests | In `server`: `npx mocha --exit test/middleware.test.js` | 6 passing |
| Frontend production build | `npm --prefix vite-project run build` | Passed |
| SDK TypeScript build | `npm --prefix sdk run build` | Failed with existing dependency type errors |
| Frontend lint | `npm --prefix vite-project run lint` | Failed with 28 existing errors |

The SDK build reports TS2694 and TS2724 in the root `@types/glob` declarations:
the resolved `minimatch` types do not export `IOptions` or `IMinimatch`.
The frontend lint findings include unused variables, empty catch blocks,
React Fast Refresh export rules, and `process` being undefined in ErrorBoundary.
These findings were left unchanged to preserve the original source snapshot.
The frontend build also reports its existing bundle-size warning.

The middleware suite was invoked directly because the existing `server` package's
`test` script is a placeholder containing `ech`; that script remains unchanged.
The SDK suites ran without a Gemini API key, using their existing mocks and
fallback behavior. Contract tests deployed only to Hardhat's local network.
No contracts were deployed to a public network and no real funds were spent.


## Reproduce the source comparison

After cloning this repository, fetch the original revision into a temporary local
reference and compare it with the final source import commit:

```sh
git fetch https://github.com/ola-893/flowpay.git de41ae887a5679942fe67796220fabe029d35f2e
git diff --exit-code FETCH_HEAD a29a3719470489f07e1eb5d4e7c73e497752a1db --
```

The comparison should produce no differences. The provenance record is added in
the following commit, so the command intentionally compares the source with the
last source import commit rather than with `HEAD`.
