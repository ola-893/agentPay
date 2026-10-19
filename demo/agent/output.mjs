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
    const lines = wrap(value, Math.max(20, width - 14));
    lines.forEach((line, index) =>
      write(
        `  ${index ? " ".repeat(12) : muted(label.padEnd(12))}${style(line)}`
      )
    );
  };
  let requestCount = 0;
  return {
    start({ settings, payer, recipient, balanceRaw }) {
      write("");
      write(`  ${accent(bold("AgentPay"))}  ${muted("AI payment demo")}`);
      separator();
      field("Mode", pay ? "PAYMENT ENABLED" : "PREVIEW ONLY", warning);
      field(
        "",
        pay
          ? "Maximum 0.01 test USDC per run + test ETH gas"
          : "No signing, token transfers or paid content access"
      );
      field("Network", "Ethereum Sepolia");
      field("Agent", `${title(settings.provider)} / ${settings.model}`);
      field("Payer", payer);
      field("Balance", `${amount(balanceRaw)} test USDC`);
      field("Recipient", recipient);
      field("Authority", "Local CRE decision enforced by the wallet");
      write("");
    },
    thinking(complete) {
      field(
        "Agent",
        complete
          ? "Reviewing verified tool results..."
          : "Choosing the next research request..."
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
      field("CRE", "Running local simulation with live price + chain data...");
    },
    decision(result) {
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
      if (verbose) {
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
    finish(result) {
      write("");
      separator();
      write(`  ${ok(bold("COMPLETE"))}  ${muted("Verified by AgentPay")}`);
      write("");
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
        "Check payment.json for any prepared transaction before another paid run."
      );
      write("");
    },
  };
}
