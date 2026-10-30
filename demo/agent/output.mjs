import { stripVTControlCharacters } from "node:util";
import { formatUnits } from "ethers";

const clean = (value) =>
  stripVTControlCharacters(String(value))
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "")
    .replace(/\t/g, "  ");
const title = (value) => value[0].toUpperCase() + value.slice(1);
const amount = (raw, decimals = 6) => {
  const [whole, fraction = ""] = formatUnits(raw, decimals).split(".");
  return `${whole}.${fraction.replace(/0+$/, "").padEnd(2, "0")}`;
};

// Presentation only. Decisions, receipts and balances always come from host checks.
export function createAgentOutput({
  pay = false,
  json = false,
  verbose = false,
  stream = json ? process.stderr : process.stdout,
  env = process.env,
  write: writeLine = (line) => console.log(line),
} = {}) {
  const color =
    !json &&
    Boolean(stream.isTTY) &&
    !Object.hasOwn(env, "NO_COLOR") &&
    env.TERM !== "dumb";
  const unicode = env.TERM !== "dumb";
  const width = Math.max(36, Math.min(92, stream.columns || 88)) - 4;
  const paint = (text, code) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
  const bold = (text) => paint(text, "1");
  const muted = (text) => paint(text, "90");
  const ok = (text) => paint(text, "32");
  const warning = (text) => paint(text, "33");
  const accent = (text) => paint(text, "36");
  let waiting;
  const stopWaiting = () => {
    if (!waiting) return;
    clearInterval(waiting);
    waiting = undefined;
    stream.write("\r\x1b[2K");
  };
  const write = line => { stopWaiting(); writeLine(line); };
  const separator = () =>
    write(`  ${muted((unicode ? "─" : "-").repeat(width))}`);
  const dot = unicode ? " · " : " / ";
  const wrap = (text, available) => {
    const lines = [];
    for (const paragraph of clean(text).split("\n")) {
      let line = "";
      for (const token of paragraph.split(/\s+/).filter(Boolean)) {
        const words = token.match(new RegExp(`.{1,${available}}`, "gu")) || [token];
        for (const word of words) {
          if (line && line.length + word.length + 1 > available) {
            lines.push(line);
            line = "";
          }
          line += (line ? " " : "") + word;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const field = (label, value, style = (text) => text) => {
    const lines = wrap(value, Math.max(12, width - 17));
    lines.forEach((line, index) =>
      write(
        `  ${index ? " ".repeat(15) : muted(label.padEnd(15))}${style(line)}`
      )
    );
  };
  const short = value => verbose ? clean(value) : clean(value).replace(/^(0x[\da-f]{8})[\da-f]+([\da-f]{6})$/i, "$1…$2");
  const elapsed = seconds => {
    const n = Math.max(0, Math.floor(seconds));
    if (n >= 3600) return `${Math.floor(n / 3600)}h ${Math.floor(n % 3600 / 60)}m`;
    if (n >= 60) return `${Math.floor(n / 60)}m ${n % 60}s`;
    return `${n}s`;
  };
  const reason = value => ({
    WITHIN_POLICY: "Within payment policy",
    HEALTHY_WITHIN_BUDGET: "Service healthy and within budget",
    SERVICE_HEALTHY: "Reuse the funded stream",
    SERVICE_UNAVAILABLE: "Service unavailable; closure requested",
    AMOUNT_EXCEEDS_POLICY: "Deposit exceeds spending cap",
    CLIENT_SHUTDOWN: "Client stopping; closure requested",
  }[value] || clean(value).replaceAll("_", " ").toLowerCase());
  let requestCount = 0, stageCount = 0, bannerShown = false, reuseShown = false, reviewActive = false, awaitingBusiness = false;
  const receiptHashes = new Set();
  const banner = () => {
    if (bannerShown) return;
    bannerShown = true;
    write("");
    write(`  ${accent(bold("AGENTPAY"))}`);
    for (const line of wrap("Deterministic payment guardrails with Chainlink CRE", width)) write(`  ${muted(line)}`);
    separator();
  };
  const stage = label => {
    write("");
    const prefix = `${String(++stageCount).padStart(2, "0")}  `;
    wrap(label, width - prefix.length).forEach((line, index) =>
      write(`  ${accent(index ? " ".repeat(prefix.length) : prefix)}${bold(line)}`));
  };
  const waitFor = label => {
    stopWaiting();
    // Only animate a real colored terminal. Logs, JSON, NO_COLOR and dumb
    // terminals receive stable text, with no cursor control or timer.
    if (!color || typeof stream.write !== "function") { field("Working", label); return; }
    const started = Date.now(), frames = unicode ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] : ["-", "\\", "|", "/"];
    let frame = 0;
    const render = () => {
      const time = elapsed((Date.now() - started) / 1000);
      const available = Math.max(8, width - time.length - 5);
      const text = clean(label);
      const visible = text.length > available ? text.slice(0, available - 1) + "…" : text;
      stream.write(`\r\x1b[2K  ${accent(frames[frame++ % frames.length])} ${visible} ${time}`);
    };
    render();
    waiting = setInterval(render, 120);
    waiting.unref();
  };
  return {
    preflight() {
      if (!verbose) banner();
      waitFor("Checking Sepolia deployment and wallet...");
    },
    dispose: stopWaiting,
    start({ settings, payer, recipient, balanceRaw, guarded = false }) {
      if (!verbose) {
        banner();
        field("Mode", pay ? "LIVE PAYMENT / Ethereum Sepolia" : "PREVIEW / no transactions", pay ? accent : warning);
        field("Agent", `${title(settings.provider)} / ${settings.model}`);
        field("Wallet", `${short(payer)}${dot}${amount(balanceRaw)} USDC`);
        field("Recipient", short(recipient));
        field("CRE", "Local CLI execution / deterministic rules");
        field("Authority", guarded ? "Separate policy signer; contract verifies OPEN / CLOSE" : "CLI signing checks; contract enforces escrow accounting");
        field("Budget", pay ? "Up to 0.01 USDC escrow + gas for stream and audit transactions" : "Live AI + CRE checks; no funding or paid access");
        field("Details", "Full commands, addresses and evidence: --verbose");
        return;
      }
      write("");
      write(`  ${accent(bold("AgentPay"))}  ${muted("Deterministic CRE payment guardrails")}`);
      separator();
      field("Mode", pay ? "PAYMENT ENABLED" : "PREVIEW ONLY", warning);
      field(
        "",
        pay
          ? "At most 0.01 test USDC escrowed + test ETH gas"
          : "No signing, token transfers or paid content access"
      );
      field("Network", "Ethereum Sepolia");
      field("Agent", `${title(settings.provider)} / ${settings.model}`);
      field("Payer", payer);
      field("Balance", `${amount(balanceRaw)} test USDC`);
      field("Recipient", recipient);
      field("Roles", "Agent proposes work; CRE checks fixed payment rules");
      field("CRE", "Deterministic guardrails / local simulation");
      field("Wallet", guarded ? "Agent submits signed OPEN/CLOSE; contract verifies policy permits" : "CLI checks gate signing of createStream / cancelStream");
      field(
        "Contract",
        "Enforces escrow, time accrual and cancellation payouts"
      );
      field(
        "Trust",
        guarded ? "Contract verifies separate local policy signatures for OPEN/CLOSE" : "Contract does not verify CRE results; payer can call it directly"
      );
      write("");
    },
    thinking(complete) {
      if (!verbose) {
        waitFor(complete ? "Agent summarizing verified results..." : "Agent choosing the next service request...");
        return;
      }
      field(
        "Agent",
        complete
          ? "Reviewing verified tool results..."
          : "Proposing the next service request..."
      );
    },
    response(data) {
      if (verbose) field("Response ID", data.id);
    },
    requested({ tier, purpose }) {
      if (!verbose) {
        requestCount++;
        stage(`AGENT / ${title(tier)} research`);
        field("Request", tier === "premium" ? "Evaluate the higher-cost service against the same guardrails" : "Buy service access through a reusable payment stream");
        return;
      }
      write("");
      write(
        `  ${accent(String(++requestCount).padStart(2, "0"))}  ${bold(
          `${title(tier)} research`
        )}`
      );
      field("Intent", purpose);
    },
    quote(quote) {
      field("Quote", `${amount(quote.amount)} USDC${dot}CRE cap 0.10 USDC`);
      field("CRE", "Checking deterministic rules against live price + chain data...");
    },
    decision(result, { prices = verbose } = {}) {
      field(
        "Decision",
        `${result.approved ? "ALLOW" : "DENY"}${dot}${
          result.reason === "WITHIN_POLICY"
            ? "Within payment policy"
            : result.reason === "AMOUNT_EXCEEDS_POLICY"
            ? "Amount exceeds spending cap"
            : result.reason
        }`,
        result.approved ? ok : warning
      );
      if (prices) {
        field("Chainlink", `$${amount(result.chainlinkPriceUsd8, 8)} USDC/USD`);
        field("Coinbase", `$${amount(result.externalPriceUsd8, 8)} USDC/USD`);
      }
    },
    denied() {
      field("Wallet", "No transaction signed; balances and nonce unchanged");
    },
    preview() {
      field("Payment", "Skipped in preview; content remains locked", muted);
    },
    preparing() {
      field("Payment", "Preparing 0.01 USDC transfer...");
    },
    submitting(data) {
      field("Payment", "Transaction signed; awaiting 2 confirmations...");
      if (verbose) field("Tx hash", data.transactionHash);
    },
    confirmed(receipt) {
      field(
        "Payment",
        `CONFIRMED${dot}0.01 USDC${dot}block ${receipt.blockNumber}${dot}${receipt.confirmations} confirmations`,
        ok
      );
    },
    unlocked() {
      field("Access", "Research unlocked; receipt verified", ok);
    },
    streamContract(address) {
      field("Escrow", short(address));
    },
    streamQuote(q) {
      if (!verbose) {
        field("Quote", `${amount(q.amountRaw)} USDC${dot}${elapsed(q.durationSeconds)} stream`);
        field("Rate", `${amount(q.rateRawPerSecond)} USDC/s`);
        return;
      }
      field(
        "Deposit",
        `${amount(q.amountRaw)} USDC over ${q.durationSeconds}s`
      );
      field("Rate", `${q.rateRawPerSecond} raw units / second`);
    },
    streamChecking(label) {
      if (!verbose) {
        const labels = {"USDC price safety": "PRICE SAFETY", open: "STREAM ADMISSION", healthy: "HEALTHY CHECKPOINT", outage: "FAILURE CHECKPOINT", deny: "BUDGET CHECK", cleanup: "SHUTDOWN CHECK"};
        stage(`CRE / ${labels[label] || clean(label).replaceAll("-", " ").toUpperCase()}`);
        return;
      }
      field("CRE", `Applying ${label} rules to HTTP + Sepolia observations...`);
    },
    creInvocation({ command, cwd, configPath, transcriptPath }) {
      if (!verbose) {
        const args = Array.isArray(command) ? command : command.split(/\s+/);
        const target = args.indexOf("--target");
        const simulate = args.indexOf("simulate");
        field("CRE CLI", `${args[simulate + 1]}${dot}${target >= 0 ? args[target + 1] : "workflow simulation"}`);
        waitFor("Executing the local CRE workflow...");
        return;
      }
      field("Run from", `${cwd}/ (repository root relative)`);
      field(
        "Command",
        typeof command === "string" ? command : command
          .map((arg) =>
            /^[a-zA-Z0-9_./=-]+$/.test(arg) ? arg : JSON.stringify(arg)
          )
          .join(" ")
      );
      field("Config", configPath);
      field("Transcript", `${transcriptPath} (saved when CRE exits)`);
    },
    priceEvidence({ result: r, capturedAt, configSha256, logSha256 }) {
      if (!verbose) {
        field("Chainlink", `$${amount(r.chainlinkPriceUsd8, 8)} USDC/USD / finalized read`);
        field("Coinbase", `$${amount(r.externalPriceUsd8, 8)} USDC/USD / HTTP`);
        field("Price rules", `Peg within ${r.maxPegDeviationBps / 100}%; source gap at most ${r.maxDeviationBps / 100}%`);
        field("Freshness", `${elapsed(r.observedAt - r.feedUpdatedAt)} old / limit ${elapsed(r.maxFeedAgeSeconds)}`);
        this.decision(r, {prices: false});
        return;
      }
      field("HTTP GET", r.marketApiUrl);
      field("Coinbase", `$${amount(r.externalPriceUsd8, 8)} USDC/USD`);
      field("Feed", r.feedAddress);
      field(
        "Chainlink",
        `$${amount(r.chainlinkPriceUsd8, 8)} USDC/USD / finalized read`
      );
      field(
        "Feed age",
        `${r.observedAt - r.feedUpdatedAt}s / maximum ${
          r.maxFeedAgeSeconds
        }s at observation`
      );
      field(
        "Price bounds",
        `Each source within ${r.maxPegDeviationBps} bps of $1; disagreement at most ${r.maxDeviationBps} bps`
      );
      field(
        "Budget",
        `${r.request.amount} raw USDC / cap ${r.request.spendingCap} raw (6 decimals)`
      );
      this.decision(r, { prices: false });
      field(
        "CRE write",
        r.published
          ? "Report publication requested; inspect result and receipt"
          : "None / report preview only; not payment authority"
      );
      this.creValidation({ capturedAt, configSha256, logSha256 });
    },
    streamEvidence({
      config: c,
      result: r,
      capturedAt,
      configSha256,
      logSha256,
    }) {
      if (!verbose) {
        field("Health", `${r.health.serviceAvailable ? "Available" : "Unavailable"}${dot}${r.health.successfulRequests} successful / ${r.health.failedRequests} failed`);
        if (c.phase === "admission") {
          field("Budget", `${amount(c.amountRaw)} USDC deposit / max ${amount(c.spendingCapRaw)} USDC`);
          field("Rate limit", `${amount(c.maxRateRawPerSecond)} USDC/s`);
        }
        field("Failure limit", `${c.maxFailedRequests} failed requests`);
        field("Sepolia", `Read block ${c.observationBlock}${r.onchain.stream ? ` / stream #${c.streamId}` : " / USDC balance and decimals"}`);
        this.streamDecision(r);
        return;
      }
      field("HTTP GET", c.healthUrl);
      field(
        "Provider",
        `${r.health.serviceAvailable ? "available" : "unavailable"}${dot}${
          r.health.successfulRequests
        } successes / ${r.health.failedRequests} failures`
      );
      field(
        "Client",
        `${c.client.successfulRequests} successes / ${c.client.failedRequests} failures`
      );
      field(
        "Health rule",
        `Snapshot/session and counters must match; unavailable or >= ${c.maxFailedRequests} failures rejects`
      );
      field(
        "Sepolia read",
        `block ${c.observationBlock} / paymentToken(), decimals(), balanceOf(payer)`
      );
      field(
        "Token",
        `${r.onchain.paymentToken} / ${r.onchain.tokenDecimals} decimals`
      );
      field("Balance", `${amount(r.onchain.agentBalanceRaw)} USDC`);
      field(
        "Budget",
        `${c.amountRaw} raw deposit / cap ${c.spendingCapRaw} raw USDC`
      );
      field(
        "Rate bound",
        `${BigInt(c.amountRaw) / BigInt(c.durationSeconds)} raw/s / maximum ${
          c.maxRateRawPerSecond
        } raw/s; ${c.durationSeconds}s duration`
      );
      const s = r.onchain.stream;
      if (s) {
        field(
          "Stream read",
          `streams(${c.streamId})${
            s.isActive ? ` + getClaimableBalance(${c.streamId})` : ""
          }`
        );
        field(
          "State",
          `${s.isActive ? "active" : "inactive"}${dot}${
            s.totalAmount
          } raw deposit / ${s.flowRate} raw/s`
        );
        field(
          "Accrued",
          `${s.claimableRaw} raw claimable / ${s.amountWithdrawn} raw withdrawn at read block`
        );
      } else field("Stream read", "Admission / no existing stream requested");
      this.streamDecision(r);
      field("CRE write", "None / decision returned to wallet-owning CLI");
      this.creValidation({ capturedAt, configSha256, logSha256 });
    },
    creValidation({ capturedAt, configSha256, logSha256 }) {
      field(
        "Host check",
        "Result bound to run config; deterministic policy re-evaluated"
      );
      if (verbose) {
        field("Captured", capturedAt);
        field("Config SHA256", configSha256);
        field("Log SHA256", logSha256);
      }
    },
    streamDecision(result) {
      if (!verbose) {
        field("Decision", `${result.action}${dot}${reason(result.reason)}`, ["OPEN", "CONTINUE"].includes(result.action) ? ok : warning);
        if (result.action === "CLOSE") field("Next", "Obtain policy approval and confirm cancellation");
        return;
      }
      field(
        "Decision",
        `${result.action}${dot}${result.reason
          .replaceAll("_", " ")
          .toLowerCase()}`,
        ["OPEN", "CONTINUE"].includes(result.action) ? ok : warning
      );
    },
    streamTransaction(kind, data) {
      awaitingBusiness = false;
      if (!verbose) {
        const labels = {approval: "USDC approval", open: "Stream funding", close: "Stream closure"};
        field("Wallet", `${labels[kind] || clean(kind)} signed${dot}${short(data.transactionHash)}`);
        waitFor("Waiting for 2 Sepolia confirmations...");
        return;
      }
      field("Wallet", `${kind}: signed; awaiting 2 confirmations...`);
      if (verbose) field("Tx hash", data.transactionHash);
    },
    streamOpened(value) {
      if (!verbose) {
        stage(`FUNDED / Stream #${value.streamId}`);
        field("Confirmed", `${amount(value.fundedRaw)} USDC deposited in escrow`, ok);
        field("How it works", "Fund once. Earnings accrue with time. Reuse the stream for API calls.");
        return;
      }
      field(
        "Escrow",
        `Stream #${value.streamId} funded with ${amount(value.fundedRaw)} USDC`,
        ok
      );
      field(
        "Recipient",
        "Deposit is held in escrow; earnings accrue with time"
      );
    },
    streamRequests(client, id) {
      if (!verbose) {
        if (!reuseShown) { stage("REUSE / One stream, many API calls"); reuseShown = true; }
        field("API calls", `${client.successfulRequests} successful / ${client.failedRequests} failed${dot}stream #${id}`);
        field("Payments", "0 payment transactions during these requests", ok);
        return;
      }
      field(
        "API reuse",
        `Stream #${id}${dot}${client.successfulRequests} successes${dot}${client.failedRequests} failures${dot}no payment transactions`
      );
    },
    streamOutage() {
      if (!verbose) stage("PROTECT / Service failure");
      field("Demo fault", "Injecting a provider outage (HTTP 503)", warning);
    },
    streamClosed(value) {
      if (!verbose) {
        stage(`CLOSED / Stream #${value.streamId}`);
        field("Confirmed", "Cancellation mined; earnings and refund verified", ok);
        field("Service earned", `${amount(value.earnedRaw)} USDC`);
        field("Payer refunded", `${amount(value.refundedRaw)} USDC`, ok);
        return;
      }
      field("Escrow", `Stream #${value.streamId} CLOSED`, ok);
      field("Earned", `${amount(value.earnedRaw)} USDC paid on cancellation`);
      field(
        "Refunded",
        `${amount(value.refundedRaw)} USDC returned to payer`,
        ok
      );
    },
    finish(result) {
      write("");
      separator();
      write(`  ${ok(bold("COMPLETE"))}  ${muted("Run checks passed")}`);
      write("");
      if (result.schemaVersion === 2) {
        const basic = result.purchases.basic;
        field(
          "Basic",
          basic.status === "denied" ? "DENIED / no stream funded" : basic.status === "stream-completed"
            ? `Stream #${basic.streamId} CLOSED / earnings + refund verified`
            : "OPEN approved / preview only",
          ok
        );
        field("Premium", `DENIED / deposit exceeds ${result.purchases.premium.policy.capUsdc} USDC cap`, warning);
        field("Funded", `${amount(result.fundedRaw)} USDC`);
        field("Earned", `${amount(result.earnedRaw)} USDC to recipient`);
        field("Refunded", `${amount(result.refundedRaw)} USDC to payer`);
        field(
          "Payer",
          `${amount(result.initial.agentBalanceRaw)} -> ${amount(
            result.final.agentBalanceRaw
          )} USDC`
        );
        if (basic.status === "stream-completed") {
          field(
            "API requests",
            `${basic.client.successfulRequests} successful / ${basic.client.failedRequests} injected failures on one stream`
          );
          field(
            "Transactions",
            `${
              basic.funded.transactions.length + 1
            } payment lifecycle: open + close${
              basic.funded.transactions.length > 1 ? " + token approval" : ""
            }; none per API request`
          );
          field(
            "Open tx",
            verbose ? `https://sepolia.etherscan.io/tx/${basic.funded.transactions.at(-1).transactionHash}` : short(basic.funded.transactions.at(-1).transactionHash)
          );
          field(
            "Close tx",
            verbose ? `https://sepolia.etherscan.io/tx/${basic.settlement.transaction.transactionHash}` : short(basic.settlement.transaction.transactionHash)
          );
        } else field("Transaction", "None / stream was not funded");
        write("");
        if (result.audit) {
          if (!verbose) {
            field("Audit", `${receiptHashes.size ? `${receiptHashes.size} receipts confirmed here; ` : ""}${result.audit.pendingReceipts} decisions pending`);
            field("Gas", "Audit receipt transactions are additional to stream transactions");
          } else {
            field(
              "Audit blobs",
              `${result.audit.decisions} decisions / ${result.audit.directory}`
            );
            field(
              "Audit receipts",
              `${result.audit.receiptTransactions.length} cumulative receipt transactions (test ETH); ${result.audit.pendingReceipts} pending decisions`
            );
          }
        }
        field("Evidence", result.evidenceDirectory);
        if (verbose) field("Agent notes", `${result.evidenceDirectory}/result.json`);
        if (verbose) {
          write("");
          write(
            `  ${bold("Agent explanation")} ${muted("(unverified model text)")}`
          );
          for (const line of wrap(result.summary, width - 2))
            write(`  ${line}`);
        }
        write("");
        return;
      }
      field(
        "Basic",
        result.purchases.basic.status === "purchased"
          ? "PURCHASED / content unlocked"
          : "APPROVED / preview only",
        ok
      );
      field("Premium", "BLOCKED / exceeds 0.10 USDC cap", warning);
      field("Transferred", `${amount(result.paidRaw)} test USDC`);
      field(
        "Payer",
        `${amount(result.initial.agentBalanceRaw)} -> ${amount(
          result.final.agentBalanceRaw
        )} USDC`
      );
      field(
        "Recipient",
        `+${amount(
          BigInt(result.final.recipientBalanceRaw) -
            BigInt(result.initial.recipientBalanceRaw)
        )} USDC`
      );
      const receipt = result.purchases.basic.payment?.receipt;
      if (receipt) {
        field("Transaction", receipt.transactionHash);
        field(
          "Explorer",
          `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`
        );
      } else {
        field("Transaction", "None / no tokens transferred");
      }
      write("");
      field("Evidence", result.evidenceDirectory);
      field("Agent notes", `${result.evidenceDirectory}/result.json`);
      if (verbose) {
        write("");
        write(
          `  ${bold("Agent explanation")} ${muted("(unverified model text)")}`
        );
        for (const line of wrap(result.summary, width - 2)) write(`  ${line}`);
      }
      write("");
    },
    spendReview(event) {
      if (event.phase === "start") {
        reviewActive = true;
        if (!verbose) stage("CRE / SPEND REVIEW");
        this.creInvocation(event.invocation);
        return;
      }
      const r = event.record;
      reviewActive = false;
      field("Dry-run", `${(r.simulation?.status || "unavailable").toUpperCase()}${r.observedBlock ? `${dot}Sepolia block ${r.observedBlock}` : ""}`);
      field("Risk score", `${r.decision.riskScore}/100${r.intent?.policy?.maxRiskScore !== undefined ? ` (limit ${r.intent.policy.maxRiskScore})` : ""}`);
      field("Spend decision", `${r.decision.action}${dot}${reason(r.decision.reason)}`, r.decision.action === "ALLOW" ? ok : warning);
      awaitingBusiness = pay && r.decision.action === "ALLOW";
      if (awaitingBusiness) waitFor("Anchoring audit receipts before signing...");
    },
    auditProgress(line) {
      // Structured review callbacks print these facts without raw commands or hashes.
      if (/^CRE spend review:/.test(line) || (reviewActive && /^Spend (ALLOW|BLOCK|ERROR):/.test(line))) return;
      field(line.startsWith("CRE account lookup") ? "CRE retry" : "Audit", line, warning);
    },
    auditReceipt(batch) {
      receiptHashes.add(batch.transactionHash);
      field("Audit receipt", `CONFIRMED${dot}${batch.entries.length} decision record${batch.entries.length === 1 ? "" : "s"}${dot}${short(batch.transactionHash)}`, ok);
      if (awaitingBusiness) waitFor("Verifying receipt and final transaction dry-run...");
    },
    refreshing() {
      field("Freshness", "Refreshing CRE price and admission checks before signing", warning);
    },
    failed(directory, { fundingAttempted, cleanupClosed, streamId } = {}) {
      write("");
      separator();
      write(`  ${warning(bold("RUN INCOMPLETE"))}`);
      field("Evidence", directory);
      field(
        "",
        cleanupClosed
          ? `Stream #${streamId} closed during cleanup; earnings and refund verified. Inspect the original failure before starting a new paid run.`
          : fundingAttempted === false
          ? "Stopped before stream funding. Approval and audit transactions may have spent gas; inspect the saved evidence before retrying."
          : "Inspect transaction hashes before retrying. Guarded recovery: npm run recover:guarded-stream -- --stream-id <id>. Legacy: --close-stream <id>."
      );
      write("");
    },
  };
}
