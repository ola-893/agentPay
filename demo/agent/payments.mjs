import http from "node:http";
import { randomBytes } from "node:crypto";
import { Contract, Interface, ZeroAddress } from "ethers";
import { CliError } from "../../scripts/lib/cli.cjs";
import { validateResult } from "../../scripts/lib/cre-validation.mjs";

export const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
export const CHAIN_ID = 11155111n;
export const TIERS = Object.freeze({ basic: "10000", premium: "200000" });
export const PAYMENT_LIMIT = 10000n;
export const TOKEN_ABI = [
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
  "function transfer(address,uint256) returns(bool)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
];
const iface = new Interface(TOKEN_ABI);
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();

export function validateQuote(quote, { tier, agent, recipient }) {
  if (
    !quote ||
    quote.tier !== tier ||
    quote.amount !== TIERS[tier] ||
    quote.chainId !== Number(CHAIN_ID) ||
    !same(quote.token, USDC) ||
    !same(quote.agent, agent) ||
    !same(quote.recipient, recipient) ||
    !/^0x[0-9a-fA-F]{64}$/.test(quote.id) ||
    !Number.isSafeInteger(quote.blockNumber) ||
    quote.blockNumber < 0
  )
    throw new CliError(
      "QUOTE_MISMATCH",
      "Service quote does not match the trusted tier, recipient, token, chain or amount."
    );
}

export function assertLocalApproval(
  evidence,
  config,
  { elapsedMs, paidRaw = 0n }
) {
  validateResult(evidence.result, config);
  if (!evidence.result.approved || evidence.result.reason !== "WITHIN_POLICY")
    throw new CliError(
      "POLICY_DENIED",
      "CRE denied this request. No transaction may be signed."
    );
  if (
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0 ||
    elapsedMs >= config.authorizationTtlSeconds * 1000
  )
    throw new CliError(
      "POLICY_EXPIRED",
      "Local CRE approval expired before payment."
    );
  const feedAge = evidence.result.observedAt - evidence.result.feedUpdatedAt;
  if (
    !Number.isSafeInteger(feedAge) ||
    feedAge < -60 ||
    feedAge + elapsedMs / 1000 > config.maxFeedAgeSeconds
  )
    throw new CliError(
      "POLICY_EXPIRED",
      "Oracle freshness expired before payment."
    );
  if (BigInt(config.request.amount) + paidRaw > PAYMENT_LIMIT)
    throw new CliError(
      "RUN_BUDGET",
      "Demo payment limit is 0.01 USDC per run."
    );
  if (
    config.publishReport ||
    config.receiverAddress !== ZeroAddress ||
    config.request.token !== USDC ||
    same(config.request.agent, config.request.recipient)
  )
    throw new CliError(
      "PAYMENT_CONFIG",
      "Local payment requires a read-only CRE decision and a distinct USDC recipient."
    );
}

export async function verifyUsdcReceipt(provider, hash, quote) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new CliError("INVALID_RECEIPT", "Invalid payment transaction hash.");
  const receipt = await provider.getTransactionReceipt(hash);
  const tx = await provider.getTransaction(hash);
  if (
    !receipt ||
    receipt.status !== 1 ||
    receipt.blockNumber <= quote.blockNumber ||
    (await receipt.confirmations()) < 2 ||
    !tx ||
    !same(tx.from, quote.agent) ||
    !same(tx.to, USDC) ||
    tx.chainId !== CHAIN_ID ||
    tx.value !== 0n ||
    tx.data.toLowerCase() !==
      iface
        .encodeFunctionData("transfer", [quote.recipient, quote.amount])
        .toLowerCase()
  )
    throw new CliError(
      "INVALID_RECEIPT",
      "Payment receipt, confirmations, sender, chain or transfer call does not match this quote."
    );
  const matches = receipt.logs.filter((log) => {
    if (!same(log.address, USDC)) return false;
    try {
      const event = iface.parseLog(log);
      return (
        event?.name === "Transfer" &&
        same(event.args.from, quote.agent) &&
        same(event.args.to, quote.recipient) &&
        event.args.value === BigInt(quote.amount)
      );
    } catch {
      return false;
    }
  });
  if (matches.length !== 1)
    throw new CliError(
      "INVALID_RECEIPT",
      "Receipt does not contain exactly one matching Circle USDC Transfer event."
    );
  return {
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
    confirmations: await receipt.confirmations(),
    status: receipt.status,
    from: quote.agent,
    to: quote.recipient,
    token: USDC,
    amountRaw: quote.amount,
  };
}

// Historical direct-payment service, retained for regression/evidence compatibility.
// The current AI CLI uses the escrow/session service in streams.mjs.
export async function startResearchService({ provider, agent, recipient }) {
  const quotes = new Map();
  const accepted = new Map();
  const server = http.createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(body));
    };
    const tier = request.url?.match(/^\/research\/(basic|premium)$/)?.[1];
    if (request.method !== "GET" || !tier)
      return send(404, { error: "Not found" });
    try {
      if (!quotes.has(tier))
        quotes.set(tier, {
          id: "0x" + randomBytes(32).toString("hex"),
          tier,
          chainId: Number(CHAIN_ID),
          token: USDC,
          agent,
          recipient,
          amount: TIERS[tier],
          blockNumber: await provider.getBlockNumber(),
        });
      const quote = quotes.get(tier);
      const hash = request.headers["x-agentpay-payment-tx"];
      if (!hash)
        return send(402, { protocol: "agentpay-demo-receipt-v1", quote });
      if (
        typeof hash !== "string" ||
        (accepted.has(hash) && accepted.get(hash) !== tier)
      )
        return send(409, { error: "Receipt already used for another quote" });
      const receipt = await verifyUsdcReceipt(provider, hash, quote);
      accepted.set(hash, tier);
      return send(200, {
        receipt,
        research: {
          title: "USDC treasury operating note",
          source: "AgentPay demo service (sample operational guidance)",
          content:
            "Track USDC amounts in six-decimal raw units, compare independent USD price observations, and enforce spending caps before signing. A testnet token has no monetary value.",
          tier,
          quoteId: quote.id,
        },
      });
    } catch (error) {
      return send(422, {
        error:
          error instanceof CliError
            ? error.code
            : "Receipt verification failed",
      });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}

export async function snapshotWallet(provider, agent, recipient) {
  const token = new Contract(USDC, TOKEN_ABI, provider);
  return {
    agentBalanceRaw: (await token.balanceOf(agent)).toString(),
    recipientBalanceRaw: (await token.balanceOf(recipient)).toString(),
    nonce: await provider.getTransactionCount(agent, "pending"),
  };
}

// Historical direct executor; never called by the current streaming CLI.
export async function sendLocalPayment({
  provider,
  wallet,
  quote,
  evidence,
  config,
  elapsed,
  paidRaw,
  persist,
}) {
  validateQuote(quote, {
    tier: quote.tier,
    agent: config.request.agent,
    recipient: config.request.recipient,
  });
  if (
    quote.id !== config.request.requestId ||
    quote.amount !== config.request.amount ||
    quote.chainId !== config.chainId
  )
    throw new CliError(
      "QUOTE_MISMATCH",
      "Payment quote differs from the exact CRE intent."
    );
  assertLocalApproval(evidence, config, { elapsedMs: elapsed(), paidRaw });
  if (
    (await provider.getNetwork()).chainId !== CHAIN_ID ||
    !same(wallet.address, quote.agent)
  )
    throw new CliError(
      "WRONG_NETWORK",
      "Payment signer and Ethereum Sepolia must match the approved intent."
    );
  const token = new Contract(USDC, TOKEN_ABI, provider);
  if (
    (await provider.getCode(USDC)) === "0x" ||
    (await token.decimals()) !== 6n
  )
    throw new CliError(
      "TOKEN_UNITS",
      "Circle Sepolia USDC must be deployed with six decimals."
    );
  if (
    (await token.balanceOf(wallet.address)) < BigInt(quote.amount) ||
    (await provider.getBalance(wallet.address)) === 0n
  )
    throw new CliError(
      "BALANCE",
      "Payer needs Circle test USDC and Sepolia ETH."
    );
  const before = await snapshotWallet(
    provider,
    wallet.address,
    quote.recipient
  );
  const transaction = await wallet.populateTransaction({
    to: USDC,
    data: iface.encodeFunctionData("transfer", [quote.recipient, quote.amount]),
  });
  if (transaction.chainId !== CHAIN_ID)
    throw new CliError("WRONG_NETWORK", "Refusing to sign outside Sepolia.");
  assertLocalApproval(evidence, config, { elapsedMs: elapsed(), paidRaw });
  const raw = await wallet.signTransaction(transaction);
  const { keccak256 } = await import("ethers");
  const hash = keccak256(raw);
  // Record the hash before broadcasting. Never persist the signed payload or key.
  await persist({ state: "submitting", quote, transactionHash: hash, before });
  assertLocalApproval(evidence, config, { elapsedMs: elapsed(), paidRaw });
  let receipt;
  try {
    const sent = await provider.broadcastTransaction(raw);
    receipt = await sent.wait(2, 120000);
  } catch {
    throw new CliError(
      "PAYMENT_PENDING",
      `Payment submission/confirmation is uncertain. Inspect ${hash}; do not automatically retry this purchase.`
    );
  }
  if (!receipt || receipt.status !== 1)
    throw new CliError("PAYMENT_FAILED", `USDC transfer failed: ${hash}`);
  const verified = await verifyUsdcReceipt(provider, hash, quote);
  const after = await snapshotWallet(provider, wallet.address, quote.recipient);
  if (
    BigInt(after.recipientBalanceRaw) - BigInt(before.recipientBalanceRaw) !==
      BigInt(quote.amount) ||
    BigInt(before.agentBalanceRaw) - BigInt(after.agentBalanceRaw) !==
      BigInt(quote.amount)
  )
    throw new CliError(
      "BALANCE_MISMATCH",
      `Transfer ${hash} was confirmed, but exact balance changes were not established. Do not retry automatically.`
    );
  const payment = {
    state: "confirmed",
    receipt: verified,
    before,
    after,
    recipientIncreaseRaw: quote.amount,
    localCreGate: true,
    donAuthenticated: false,
  };
  await persist(payment);
  return payment;
}
