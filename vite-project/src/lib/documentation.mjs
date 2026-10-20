const repo = "https://github.com/ola-893/agentPay/blob/main/";
export const documentationSections = [
  ["overview", "Overview"],
  ["setup", "Run locally"],
  ["cre", "CRE workflow"],
  ["usdc", "USDC & policy"],
  ["agent", "Agent setup"],
  ["integration", "SDK integration"],
  ["streams", "Legacy streams"],
  ["troubleshooting", "Troubleshooting"],
];
const p = (text) => ({ type: "paragraph", text });
const list = (items) => ({ type: "list", items });
const code = (label, text) => ({ type: "code", label, text });
const table = (headers, rows) => ({ type: "table", headers, rows });
const section = (title, blocks) => ({ title, blocks });
export const documentation = {
  overview: {
    title: "Payments with boundaries you can inspect.",
    intro:
      "AgentPay uses prepaid USDC escrow streams and local CRE service-health checkpoints in its AI CLI. The browser retains recorded price-policy evidence, a local SDK draft and a separate tUSD stream UI.",
    source: "docs/README.md",
    sections: [
      section("Choose your starting point", [
        table(
          ["Page", "What it does"],
          [
            [
              "CRE Workflow",
              "Inspect saved ALLOW and over-budget DENY runs. No wallet required.",
            ],
            [
              "Agent setup",
              "Validate addresses, save a local draft, and copy a guarded SDK example. No wallet required.",
            ],
            [
              "Streams",
              "Manage a separate 18-decimal tUSD streaming deployment with a connected wallet.",
            ],
          ]
        ),
      ]),
      section("What is demonstrated", [
        p(
          "The checked-in CRE captures compile the workflow to WASM, fetch Coinbase USDC/USD, read the Chainlink USDC/USD feed and Circle token decimals at finalized blocks, evaluate policy, and generate a bounded report. The ALLOW request is 0.01 USDC against a 0.1 cap; DENY requests 0.2 USDC."
        ),
        p(
          "The dashboard loads recorded JSON. It does not fetch live prices, deploy a workflow, broadcast a report or send payments. A saved ALLOW result is historical evidence, not an active authorization."
        ),
      ]),
      section("Current scope", [
        list([
          "Ethereum Sepolia only; testnet USDC and tUSD have no monetary value.",
          "CRE stays local. The AI CLI has separate verified Sepolia stream funding, request reuse, closure and refund evidence.",
          "The CLI gates wallet signing on local CRE decisions. The stream contract enforces escrow accounting and payouts; it does not verify CRE results, and a payer can call it directly.",
          "The legacy gateway uses AgentPay-specific HTTP 402 headers. It does not implement the full current x402 transport/facilitator protocol.",
          "This is an unaudited prototype.",
        ]),
      ]),
    ],
    related: [
      ["/docs/setup", "Run locally"],
      ["/docs/cre", "Understand CRE"],
      ["/docs/agent", "Prepare an agent"],
    ],
  },
  setup: {
    title: "Run the app. Reproduce the evidence.",
    intro:
      "Start with the recorded dashboard; use CRE when you want to execute the workflow against live inputs.",
    source: "docs/getting-started/quick-start.md",
    sections: [
      section("1. Open the frontend", [
        p(
          "Use Node.js 22 and npm. Run these commands from the repository root. Open the local URL printed by Vite; the port may change if another process is using it."
        ),
        code("Terminal", "npm run install:all\nnpm run dev"),
        p(
          "Node 22 is the verified major version. No wallet, contract deployment, Bun, CRE login, or private key is required to view existing evidence or use Agent setup."
        ),
      ]),
      section("2. Run CRE with live inputs", [
        p(
          "Install the official CRE CLI and Bun. CI uses Bun 1.3.12. Authenticate the CLI, install the workflow dependencies, then dry-run both npm scenarios. No wallet funds or key are needed for these read-only runs."
        ),
        code(
          "Terminal",
          "npm run install:cre\ncre login\nnpm run cre:dry-run\nnpm run cre:simulate\nnpm run cre:simulate -- --deny-budget"
        ),
        p(
          "The dry run checks expected decisions and more than ten minutes of remaining feed freshness. Network/API/feed changes may deny a future run. Wait for healthy inputs instead of weakening policy to manufacture ALLOW."
        ),
      ]),
      section("3. Refresh the frontend captures", [
        code(
          "Terminal",
          "npm run cre:capture\nnpm run cre:capture -- --deny-budget"
        ),
        p(
          "A successful capture writes the transcript and JSON to docs/evidence and the frontend JSON to vite-project/public/evidence. Previous captures are retained under content-addressed backups. CLI or expected-decision failures leave saved captures intact. Output writes are sequential; after an interrupted file write, restore the backup and run npm run docs:check to detect mixed copies. These commands do not broadcast."
        ),
      ]),
      section("4. Verify local changes", [
        code(
          "Terminal",
          "npm run docs:check\nnpm test\nnpm run build:sdk\nnpm run typecheck:cre\nnpm --prefix vite-project run lint\nnpm run build:web"
        ),
        p(
          "Frontend output is vite-project/dist. Static hosting must route app URLs such as /docs/cre back to index.html; preserve the included SPA fallback."
        ),
      ]),
    ],
    related: [
      ["/docs/troubleshooting", "Resolve setup problems"],
      ["/docs/streams", "Configure legacy streams"],
    ],
  },
  cre: {
    title: "One workflow, two price observations.",
    intro:
      "CRE orchestrates the HTTP call, finalized onchain reads, integer policy evaluation and report generation.",
    source: "docs/WORKFLOW.md",
    sections: [
      section("Execution flow", [
        list([
          "A cron trigger starts the single sample payment intent every five minutes in the configured workflow. Simulation explicitly selects that trigger.",
          "HTTPClient fetches Coinbase USDC/USD and aggregates quotes with median consensus.",
          "EVMClient reads the Sepolia feed description, decimals and latestRoundData, plus Circle USDC decimals, at finalized blocks.",
          "The policy rejects invalid/incomplete rounds, future or stale data, price disagreement, deviation from $1 and an amount above the cap.",
          "CRE generates a report binding chain, receiver, request ID, agent, recipient, token, amount, expiry and approved/denied decision.",
        ]),
      ]),
      section("Decisions and units", [
        table(
          ["Scenario", "Request", "Cap", "Expected reason"],
          [
            [
              "Within budget",
              "10000 = 0.01 USDC",
              "100000 = 0.1 USDC",
              "WITHIN_POLICY",
            ],
            [
              "Over budget",
              "200000 = 0.2 USDC",
              "100000 = 0.1 USDC",
              "AMOUNT_EXCEEDS_POLICY",
            ],
          ]
        ),
        p(
          "The DENY runner doubles the requested amount only. It does not change the price checks or spending cap. Live unhealthy inputs may trigger an earlier denial; the runner then fails the expected-scenario check."
        ),
      ]),
      section("Simulation output and contract checks", [
        p(
          "CRE runs locally through the CLI. The receiver is zero and publishReport is false; ALLOW and DENY are simulation results, not USDC transfers. Workflow deployment to Chainlink's network and the public DON-authorized payment test are outside scope. Previously deployed Sepolia guard and settlement contracts remain closed with a zero workflow ID. Their authorization, expiry and replay behavior is tested separately on a local chain."
        ),
        p(
          "The ALLOW report’s maximum is the requested 10000 units (0.01 USDC), not the 100000-unit policy cap. Reports expire after 300 seconds in the sample. Request IDs are single-use, so a real intent needs a fresh ID and real parties. The fixed sample ID is for read-only reproduction."
        ),
      ]),
      section("Optional simulation write", [
        p(
          "A separate AgentPaySimulationReceiver accepts the simulator’s mock forwarder with an explicit identity-skip opt-in. It is record-only and cannot authorize or settle payments. Production identity checks remain enabled. The write runner simulates by default; only explicit --broadcast sends a testnet report, and public publication claims require an independently verified RPC receipt and matching receiver event."
        ),
        p(
          "Deployment and broadcast require a dedicated funded Sepolia wallet. Follow the repository recording guide for the operator steps; these steps have not been performed by the saved read-only evidence."
        ),
      ]),
    ],
    related: [
      ["/docs/usdc", "Read the USDC policy"],
      ["/docs/integration", "Settle through the SDK"],
      [
        "https://github.com/ola-893/agentPay/blob/main/docs/deployment/guarded-usdc.md",
        "Existing Sepolia contract record",
      ],
    ],
  },
  usdc: {
    title: "USDC payments. USDC/USD policy.",
    intro:
      "The token, decimals, chain, feed and API are bound together. Changing only the payment-token address is not a supported asset swap.",
    source: "docs/USDC_SEPOLIA.md",
    sections: [
      section("Sepolia addresses", [
        table(
          ["Setting", "Value"],
          [
            ["Chain ID", "11155111"],
            ["Circle USDC", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"],
            ["USDC decimals", "6"],
            [
              "Chainlink USDC/USD",
              "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
            ],
            ["Price decimals", "8"],
            [
              "Coinbase endpoint",
              "https://api.coinbase.com/v2/prices/USDC-USD/spot",
            ],
          ]
        ),
        p(
          "The source-verification snapshot records the official Circle and Chainlink directory entries checked on 17 October 2026. The workflow also validates the pair description and token decimals onchain."
        ),
      ]),
      section("Exact integer scales", [
        p(
          "USDC amounts use six decimals: 0.01 USDC = 10000 raw units, 0.1 USDC = 100000 and 0.2 USDC = 200000. Prices use a separate eight-decimal scale: $1 = 100000000. The SDK pay method accepts bigint raw units; do not use parseEther for USDC."
        ),
        code(
          "TypeScript",
          "import { parseUnits, formatUnits } from 'ethers';\nconst amount = parseUnits('0.01', 6); // 10000n\nconst display = formatUnits(amount, 6); // '0.01'"
        ),
      ]),
      section("Peg and freshness limits", [
        list([
          "Source disagreement must be at most 100 basis points (1%), relative to Chainlink’s quote.",
          "Each source must independently stay within 100 basis points of $1, inclusive. Matching prices at $0.98 still fail with USDC_DEPEG.",
          "The maximum feed age is 86400 seconds, matching the listed 24-hour heartbeat. This testnet setting does not promise immediate depeg detection.",
          "Feed timestamps more than 60 seconds ahead of runtime, invalid answers or incomplete rounds are rejected.",
        ]),
        p(
          "Sepolia USDC has no monetary value and is not backed by real dollars. The USD quotes model payment-asset risk; they do not give test tokens a redemption value. Get test USDC from Circle’s faucet with Ethereum Sepolia selected."
        ),
      ]),
    ],
    related: [
      [
        "https://developers.circle.com/stablecoins/usdc-contract-addresses",
        "Circle contract addresses",
      ],
      ["https://faucet.circle.com/", "Circle test USDC faucet"],
      [
        "https://docs.chain.link/data-feeds/price-feeds/addresses",
        "Chainlink feed addresses",
      ],
    ],
  },
  agent: {
    title: "Prepare an agent integration draft.",
    intro:
      "Agent setup creates a browser-local configuration and a copyable SDK example. It does not operate a running agent.",
    source: "docs/AGENT_SETUP.md",
    sections: [
      section("Use Agent setup", [
        list([
          "Open Agent setup from the main or mobile navigation. No wallet is needed.",
          "Enter a draft name, deployed guard and settlement addresses, recipient and a positive USDC amount with at most six decimals.",
          "Valid values generate a TypeScript example with the exact bigint amount. Validation checks format, not whether these contracts are deployed or correctly configured.",
          "Save local draft stores versioned JSON in this browser. Reload restores it. Reset removes the draft.",
          "Copy the example into your own Node/TypeScript agent and supply its connected signer and a freshly authorized request ID.",
        ]),
      ]),
      section("What saving changes", [
        p(
          "A draft does not change CRE configuration, onchain policy, a spending cap, API keys or workflow status. There is no live agent telemetry, emergency stop, automated deployment or payment submission on this page. No private key belongs in a browser field or VITE_ variable."
        ),
        p(
          "Browser storage may be unavailable or cleared, and other code on the same origin can read it. Store only these non-secret configuration fields. Saving is optional; code can still be copied if storage is blocked."
        ),
      ]),
      section("Run the AI CLI demo", [
        p(
          "The separate CLI uses real Qwen or OpenAI tool calls and a USDC-configured escrow stream. Local CRE evaluates admission, healthy continuation and outage-triggered closure using HTTP observations and Sepolia state. Configure the model key, dedicated payer, recipient and AGENTPAY_USDC_STREAM_ADDRESS in ignored root .env."
        ),
        code("sh", "npm run demo:agent\nnpm run demo:agent -- --pay"),
        p(
          "Preview evaluates OPEN and DENY without signing. With --pay, basic deposits 0.01 USDC over 1000 seconds, ten successful API requests reuse the stream, and an injected outage produces CRE CLOSE. The wallet cancels, paying time-accrued earnings and refunding unused funds. Premium proposes 0.2 against a 0.1 deposit cap and is denied. Each paid run is a new stream and spends test ETH gas. Output shows each CRE command, HTTP observations, Sepolia block, policy limits and transcript path. Use --close-stream <id> to recover an owned stream, --verbose for model details and evidence hashes, and --json for structured output. The CLI gates signing; the contract enforces escrow and payouts without checking CRE results. A payer can call the contract directly. No CRE network deployment, DON authentication, AgentPaySettlement or full x402 is used."
        ),
      ]),
      section("ToolBuyer: trial quality before purchasing", [
        p(
          "The ToolBuyer CLI asks a local CRE workflow to buy task-specific trial answers, update uncertain quality estimates and stop when another trial costs more than its expected one-step benefit. It compares held-out results against cheapest, fixed-showcase and fixed-expert providers, counting every trial and service answer."
        ),
        code(
          "sh",
          "npm run --silent demo:toolbuyer\nnpm run --silent demo:toolbuyer -- --offline --seeds 17,29,43,71,97"
        ),
        p(
          "Providers are synthetic and purchases debit benchmark credits, not USDC. Default mode makes real CRE HTTP and Sepolia budget reads; offline mode uses neither CRE nor the chain. No model API key or signing is required. The recorded selector beats cheapest/showcase but loses to the always-strong baseline. This browser page does not run the benchmark or show live results."
        ),
      ]),
      section("Strict SDK integration prerequisites", [
        p(
          "The generated GuardedPaymentClient example uses a different authority path: configured strict consumers and an authenticated unexpired report for the exact intent. The current public guard is closed and this project does not deploy a workflow to Chainlink. The SDK checks onchain authorization before approval and settlement; local simulation output cannot unlock it."
        ),
      ]),
    ],
    related: [
      ["/agent", "Open Agent setup"],
      ["/docs/integration", "SDK integration"],
      [repo + "docs/AI_AGENT_DEMO.md", "AI purchasing CLI guide"],
      [repo + "docs/TOOLBUYER.md", "ToolBuyer mechanism and comparison"],
    ],
  },
  integration: {
    title: "Authorize first. Approve tokens second.",
    intro:
      "Use GuardedPaymentClient for CRE-controlled USDC settlement. It is distinct from the legacy AgentPaySDK stream client.",
    source: "docs/sdk/guarded-payment-client.md",
    sections: [
      section("Use the local SDK", [
        p(
          "Save these integration fragments inside sdk/ (for example sdk/integration.ts), importing ./src and ethers from that directory. Supply the listed variables and place awaited calls inside an async agent function. The root and SDK install separate ethers copies; a root-created signer can fail TypeScript checks. For another application, align the SDK and signer’s ethers dependency before use. No published npm package is assumed."
        ),
        code(
          "TypeScript",
          "import { GuardedPaymentClient } from './src';\n\n// signer, guardAddress, settlementAddress, recipient and\n// requestId must come from your real Sepolia deployment.\nconst client = new GuardedPaymentClient(signer, {\n  guardAddress,\n  settlementAddress,\n  chainId: 11155111,\n});\n\n// AFTER the authenticated report is accepted onchain:\nconst receipt = await client.pay(\n  requestId,\n  recipient,\n  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',\n  10000n, // 0.01 USDC\n);\nconsole.log(receipt.hash);"
        ),
      ]),
      section("Checks performed by pay", [
        list([
          "Validate request ID, nonzero payment addresses, positive uint256 amount and connected signer.",
          "Verify the signer’s chain and the settlement contract’s guard address.",
          "Call guard.canPay for the exact request ID, signer, recipient, token and amount before approving tokens.",
          "Approve the settlement contract if allowance is insufficient, wait for confirmation, then check canPay again.",
          "Call settlement.settle and require a successful receipt. The contract consumes the authorization atomically; a failed transfer reverts consumption.",
        ]),
      ]),
      section("Common authorization failures", [
        p(
          "Missing, denied, expired or consumed authorization fails before approval. Another signer, recipient, token, chain or destination cannot use the report. The payment amount must be positive and no greater than the report’s maximum; one smaller payment consumes the entire request, so leftover headroom is not reusable. A saved JSON capture, a raw ABI report body and a transaction hash are not spend authority."
        ),
        p(
          "The current streaming gateway does not automatically recognize a guarded settlement receipt for API access. Add a separate authenticated receipt-to-service policy if integrating a paid API."
        ),
      ]),
    ],
    related: [
      ["/docs/agent", "Configure a local draft"],
      [repo + "DEPLOYMENT.md", "Deploy the strict consumer"],
    ],
  },
  streams: {
    title: "Manage legacy tUSD streams.",
    intro:
      "This is the separate 18-decimal streaming path. Do not configure Circle USDC as its token.",
    source: "docs/architecture/payment-streams.md",
    sections: [
      section("Deploy and configure", [
        p(
          "Use a dedicated Sepolia test wallet and the root .env.example. npm run deploy:sepolia deploys MockUSD and AgentPayStream. It does not deploy the CRE consumer or Circle USDC. Copy the printed addresses into vite-project/.env.local and restart Vite."
        ),
        code(
          "vite-project/.env.local",
          "VITE_CONTRACT_ADDRESS=<deployed-AgentPayStream>\nVITE_PAYMENT_TOKEN_ADDRESS=<deployed-18-decimal-MockUSD>"
        ),
        p(
          "Without both addresses, Streams shows setup guidance. The chain is fixed to Ethereum Sepolia. Frontend configuration is public; never include a private key."
        ),
      ]),
      section("Create a stream", [
        list([
          "Connect a browser wallet on Sepolia. Mint test tUSD using the configured MockUSD contract if needed.",
          "Enter a nonzero recipient address, amount and whole-second duration. ENS resolution is not supported.",
          "The default duration is 24 hours; presets and custom seconds use the same form state. Use balance copies the wallet’s fetched tUSD balance.",
          "The per-second integer flow rate must be nonzero. Your wallet may request token approval and stream creation as separate confirmations.",
          "Wait for confirmation before starting another transaction. Missing balances and RPC failures are shown explicitly.",
        ]),
      ]),
      section("Withdraw or close", [
        p(
          "Incoming cards estimate claimable funds after subtracting previous withdrawals. At the stop time the entire unwithdrawn remainder becomes claimable, including integer rounding dust. The final amount is determined onchain. The recipient can still withdraw an ended stream while it remains active in contract storage."
        ),
        p(
          "Either party can close an active stream. Accrued funds go to the recipient and unspent funds return to the sender. Closing requires wallet confirmation. Stream discovery covers the most recent 49000 blocks; use Withdraw by stream ID to check an older stream. Changing that ID clears a stale balance check."
        ),
      ]),
      section("Wallet sessions", [
        p(
          "Switching account/network or disconnecting invalidates the app’s session; reconnect to refresh it. Disconnect wallet clears AgentPay’s local session, not the wallet extension’s site permissions. Revoke those separately in your wallet if needed."
        ),
      ]),
    ],
    related: [
      ["/streams", "Open Streams"],
      [repo + "DEPLOYMENT.md", "Deployment instructions"],
    ],
  },
  troubleshooting: {
    title: "Find the next useful step.",
    intro:
      "Start with the state shown on screen or the exact CLI reason. Do not treat an empty balance, saved capture or mock receipt as proof of payment.",
    source: "docs/reference/troubleshooting.md",
    sections: [
      section("Frontend", [
        table(
          ["Symptom", "Next step"],
          [
            [
              "Evidence unavailable",
              "Check the JSON exists in vite-project/public/evidence. Retry after restoring it, or capture both scenarios with CRE.",
            ],
            [
              "Streams shows setup instructions",
              "Set both legacy contract addresses in vite-project/.env.local and restart Vite.",
            ],
            [
              "No browser wallet detected",
              "Use a wallet-enabled browser. Workflow evidence and Agent setup remain available without it.",
            ],
            [
              "Wallet request already open",
              "Open the wallet and approve or reject the existing connection request.",
            ],
            [
              "Wallet account or network changed",
              "Reconnect on Ethereum Sepolia.",
            ],
            [
              "Balance unavailable / streams could not refresh",
              "Check RPC access, deployment addresses, token decimals and the configured stream token. Use Retry; failure is not a zero balance.",
            ],
            [
              "Draft did not persist",
              "Browser storage may be blocked or cleared. Copy the example or enable storage for this origin.",
            ],
          ]
        ),
      ]),
      section("CRE and settlement", [
        table(
          ["Reason or symptom", "Meaning"],
          [
            [
              "Authentication / network error",
              "Verify CRE login, account access and connectivity to CRE services, Coinbase and the configured Sepolia RPC.",
            ],
            [
              "FEED_STALE / FEED_NEAR_EXPIRY",
              "The feed or recording headroom is too old. Wait for a feed update and repeat the dry run.",
            ],
            [
              "PRICE_DEVIATION / USDC_DEPEG",
              "Live data violates the price policy. Inspect both sources; do not loosen thresholds for a capture.",
            ],
            [
              "AMOUNT_EXCEEDS_POLICY",
              "The raw amount exceeds the per-request cap. This is expected only for the budget-DENY scenario.",
            ],
            [
              "CRE authorization missing / expired / consumed",
              "Obtain a fresh authenticated report for the exact request tuple, then retry with its unused request ID.",
            ],
            [
              "Direct transaction-hash payments disabled",
              "The legacy gateway deliberately rejects hash-only proof. A guarded receipt needs its own authenticated API integration.",
            ],
          ]
        ),
      ]),
      section("Known verification limits", [
        p(
          "The UI review verified responsive routes, schema validation, copy behavior, local draft persistence and evidence-error recovery. Live wallet signing, stream transactions and public deployment were not exercised in that pass because no wallet/deployments were configured. Repository contract/SDK tests cover their separate logic. The documentation audit compiles exact examples and checks transcript hashes, frontend copies and report fields; these checks do not execute a public payment. See the UI review and submission guide for evidence and limits."
        ),
      ]),
    ],
    related: [
      [repo + "docs/UI_UX_REVIEW.md", "UI review"],
      [repo + "docs/CRE_SUBMISSION.md", "Submission evidence"],
      [
        repo + "docs/DOCUMENTATION_AUDIT.md",
        "Correctness audit and verification limits",
      ],
    ],
  },
};
