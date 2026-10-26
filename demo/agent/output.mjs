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
  write = (line) => console.log(line),
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
  const separator = () =>
    write(`  ${muted((unicode ? "─" : "-").repeat(width))}`);
  const dot = unicode ? " · " : " / ";
  const wrap = (text, available) => {
    const lines = [];
    for (const paragraph of clean(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && line.length + word.length + 1 > available) {
          lines.push(line);
          line = "";
        }
        line += (line ? " " : "") + word;
      }
      lines.push(line);
    }
    return lines;
  };
  const field = (label, value, style = (text) => text) => {
    const lines = wrap(value, Math.max(20, width - 16));
    lines.forEach((line, index) =>
      write(
        `  ${index ? " ".repeat(14) : muted(label.padEnd(14))}${style(line)}`
      )
    );
  };
  let requestCount = 0;
  return {
    start({ settings, payer, recipient, balanceRaw, guarded = false }) {
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
      field("Escrow", address);
    },
    streamQuote(q) {
      field(
        "Deposit",
        `${amount(q.amountRaw)} USDC over ${q.durationSeconds}s`
      );
      field("Rate", `${q.rateRawPerSecond} raw units / second`);
    },
    streamChecking(label) {
      field("CRE", `Applying ${label} rules to HTTP + Sepolia observations...`);
    },
    creInvocation({ command, cwd, configPath, transcriptPath }) {
      field("Run from", `${cwd}/ (repository root relative)`);
      field(
        "Command",
        command
          .map((arg) =>
            /^[a-zA-Z0-9_./=-]+$/.test(arg) ? arg : JSON.stringify(arg)
          )
          .join(" ")
      );
      field("Config", configPath);
      field("Transcript", `${transcriptPath} (saved when CRE exits)`);
    },
    priceEvidence({ result: r, capturedAt, configSha256, logSha256 }) {
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
      field(
        "Decision",
        `${result.action}${dot}${result.reason
          .replaceAll("_", " ")
          .toLowerCase()}`,
        ["OPEN", "CONTINUE"].includes(result.action) ? ok : warning
      );
    },
    streamTransaction(kind, data) {
      field("Wallet", `${kind}: signed; awaiting 2 confirmations...`);
      if (verbose) field("Tx hash", data.transactionHash);
    },
    streamOpened(value) {
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
      field(
        "API reuse",
        `Stream #${id}${dot}${client.successfulRequests} successes${dot}${client.failedRequests} failures${dot}no payment transactions`
      );
    },
    streamOutage() {
      field("Demo fault", "Injecting a provider outage (HTTP 503)", warning);
    },
    streamClosed(value) {
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
        field("Funded", `${amount(result.fundedRaw)} test USDC`);
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
            `https://sepolia.etherscan.io/tx/${
              basic.funded.transactions.at(-1).transactionHash
            }`
          );
          field(
            "Close tx",
            `https://sepolia.etherscan.io/tx/${basic.settlement.transaction.transactionHash}`
          );
        } else field("Transaction", "None / stream was not funded");
        write("");
        if (result.audit) {
          field(
            "Audit blobs",
            `${result.audit.decisions} decisions / ${result.audit.directory}`
          );
          field(
            "Audit receipts",
            `${result.audit.receiptTransactions.length} cumulative receipt transactions (test ETH); ${result.audit.pendingReceipts} pending decisions`
          );
        }
        field("Evidence", result.evidenceDirectory);
        field("Agent notes", `${result.evidenceDirectory}/result.json`);
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
    failed(directory) {
      write("");
      separator();
      write(`  ${warning(bold("RUN INCOMPLETE"))}`);
      field("Evidence", directory);
      field(
        "",
        "Inspect transaction hashes before retrying. Guarded recovery: npm run recover:guarded-stream -- --stream-id <id>. Legacy: --close-stream <id>."
      );
      write("");
    },
  };
}
