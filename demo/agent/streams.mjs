import http from "node:http";
import { createRequire } from "node:module";
const deployment = createRequire(import.meta.url)(
  "../../docs/deployment/usdc-stream.json"
);
import { randomBytes } from "node:crypto";
import {
  Contract,
  Interface,
  verifyMessage,
  keccak256,
  isAddress,
  ZeroAddress,
} from "ethers";
import cli from "../../scripts/lib/cli.cjs";
import { USDC, CHAIN_ID, TIERS, snapshotWallet } from "./payments.mjs";
export { USDC, CHAIN_ID, TIERS, snapshotWallet };
export const DURATION = 1000;
export const STREAM_ABI = [
  "function paymentToken() view returns(address)",
  "function createStream(address,uint256,uint256,string)",
  "function streams(uint256) view returns(address sender,address recipient,uint256 totalAmount,uint256 flowRate,uint256 startTime,uint256 stopTime,uint256 amountWithdrawn,bool isActive,string metadata)",
  "function getClaimableBalance(uint256) view returns(uint256)",
  "function cancelStream(uint256)",
  "event StreamCreated(uint256 indexed streamId,address indexed sender,address indexed recipient,uint256 totalAmount,uint256 startTime,uint256 stopTime,string metadata)",
  "event StreamCancelled(uint256 indexed streamId,address sender,address recipient,uint256 senderBalance,uint256 recipientBalance)",
];
const TOKEN_ABI = [
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)",
];
const iface = new Interface(STREAM_ABI),
  tokenIface = new Interface(TOKEN_ABI);
const same = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.toLowerCase() === b.toLowerCase();
const metadata = (q) =>
  JSON.stringify({ sessionId: q.sessionId, quoteId: q.id });
export const sessionMessage = (origin, q, id) =>
  `AgentPay stream session v1\nOrigin: ${origin}\nChain: ${
    q.chainId
  }\nSession: ${q.sessionId}\nQuote: ${
    q.id
  }\nContract: ${q.streamAddress.toLowerCase()}\nStream: ${id}\nPayer: ${q.agent.toLowerCase()}`;
export function validateStreamQuote(
  q,
  { tier, agent, recipient, streamAddress, sessionId }
) {
  if (
    !["basic", "premium"].includes(tier) ||
    !q ||
    q.protocol !== "agentpay-stream-session-v1" ||
    q.tier !== tier ||
    q.amountRaw !== TIERS[tier] ||
    q.durationSeconds !== DURATION ||
    q.rateRawPerSecond !==
      (BigInt(TIERS[tier]) / BigInt(DURATION)).toString() ||
    q.chainId !== Number(CHAIN_ID) ||
    !same(q.token, USDC) ||
    !same(q.agent, agent) ||
    !same(q.recipient, recipient) ||
    same(q.recipient, q.streamAddress) ||
    same(q.recipient, q.token) ||
    same(q.recipient, q.agent) ||
    !same(q.streamAddress, streamAddress) ||
    q.sessionId !== sessionId ||
    !/^0x[0-9a-fA-F]{64}$/.test(q.id) ||
    !Number.isSafeInteger(q.blockTimestamp) ||
    q.blockTimestamp < 0
  )
    throw new cli.CliError(
      "QUOTE_MISMATCH",
      "Stream quote differs from the fixed tier, token, parties, duration or session."
    );
}
export async function verifyStreamDeployment(provider, address) {
  if (!isAddress(address || "") || address === ZeroAddress)
    throw new cli.CliError(
      "CONFIG",
      "Set AGENTPAY_USDC_STREAM_ADDRESS to an AgentPayStream deployment configured for Circle USDC.",
      2
    );
  if ((await provider.getNetwork()).chainId !== CHAIN_ID)
    throw new cli.CliError("WRONG_NETWORK", "Use Ethereum Sepolia.");
  const code = await provider.getCode(address);
  if (code === "0x" || keccak256(code) !== deployment.runtimeCodeHash)
    throw new cli.CliError(
      "DEPLOYMENT",
      "Stream runtime does not match the audited AgentPayStream bytecode."
    );
  const stream = new Contract(address, STREAM_ABI, provider),
    token = new Contract(USDC, TOKEN_ABI, provider);
  if (
    !same(await stream.paymentToken(), USDC) ||
    (await token.decimals()) !== 6n
  )
    throw new cli.CliError(
      "TOKEN_UNITS",
      "Stream must use Circle Sepolia USDC with six decimals. Legacy tUSD deployment cannot be reused."
    );
  return stream;
}
export async function readStream(provider, address, id, blockTag = "latest") {
  const s = await new Contract(address, STREAM_ABI, provider).streams(id, {
    blockTag,
  });
  return {
    sender: s.sender,
    recipient: s.recipient,
    totalAmount: s.totalAmount.toString(),
    flowRate: s.flowRate.toString(),
    startTime: s.startTime.toString(),
    stopTime: s.stopTime.toString(),
    amountWithdrawn: s.amountWithdrawn.toString(),
    isActive: s.isActive,
    metadata: s.metadata,
  };
}
export function assertStreamIntent(s, q) {
  if (
    !same(s.sender, q.agent) ||
    !same(s.recipient, q.recipient) ||
    s.totalAmount !== q.amountRaw ||
    s.flowRate !== q.rateRawPerSecond ||
    BigInt(s.stopTime) - BigInt(s.startTime) !== BigInt(q.durationSeconds) ||
    s.metadata !== metadata(q)
  )
    throw new cli.CliError(
      "STREAM_MISMATCH",
      "Onchain stream does not match the funded session."
    );
}
export async function startStreamService({
  provider,
  agent,
  recipient,
  streamAddress,
  sessionId,
}) {
  const quotes = new Map(),
    snapshots = new Map();
  let failed = false,
    url;
  const counts = { successfulRequests: 0, failedRequests: 0 };
  const server = http.createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "GET") return send(405, { error: "GET required" });
    if (req.url.startsWith("/health/")) {
      const value = snapshots.get(req.url.slice(8));
      return value
        ? send(200, value)
        : send(404, { error: "Unknown snapshot" });
    }
    const tier = req.url.match(/^\/research\/(basic|premium)$/)?.[1];
    if (!tier) return send(404, { error: "Not found" });
    try {
      if (!quotes.has(tier)) {
        const block = await provider.getBlock("latest");
        quotes.set(tier, {
          protocol: "agentpay-stream-session-v1",
          id: "0x" + randomBytes(32).toString("hex"),
          sessionId,
          tier,
          chainId: Number(CHAIN_ID),
          token: USDC,
          streamAddress,
          agent,
          recipient,
          amountRaw: TIERS[tier],
          durationSeconds: DURATION,
          rateRawPerSecond: (BigInt(TIERS[tier]) / BigInt(DURATION)).toString(),
          blockTimestamp: block.timestamp,
        });
      }
      const q = quotes.get(tier),
        id = req.headers["x-agentpay-stream-id"],
        signature = req.headers["x-agentpay-session-signature"];
      if (!id || !signature) return send(402, { quote: q });
      if (
        typeof id !== "string" ||
        !/^\d+$/.test(id) ||
        BigInt(id) === 0n ||
        typeof signature !== "string" ||
        !same(verifyMessage(sessionMessage(url, q, id), signature), agent)
      )
        return send(401, { error: "Authenticated payer session required" });
      const [s, block] = await Promise.all([
        readStream(provider, streamAddress, id),
        provider.getBlock("latest"),
      ]);
      assertStreamIntent(s, q);
      if (
        !s.isActive ||
        BigInt(s.startTime) <= BigInt(q.blockTimestamp) ||
        BigInt(s.stopTime) <= BigInt(block.timestamp)
      )
        return send(402, {
          error: "Stream inactive, expired or older than quote",
        });
      if (failed) {
        counts.failedRequests++;
        return send(503, {
          error: "Injected demo provider outage",
          faultInjected: true,
        });
      }
      counts.successfulRequests++;
      return send(200, {
        streamId: id,
        sessionId,
        quoteId: q.id,
        research: {
          source: "AgentPay stream demo (sample operational guidance)",
          content:
            "A funded stream amortizes payment transactions across service requests; earnings accrue with time until cancellation or expiry.",
        },
      });
    } catch (error) {
      return send(422, {
        error:
          error instanceof cli.CliError
            ? error.code
            : "Stream verification failed",
      });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    injectOutage() {
      failed = true;
    },
    snapshot() {
      const observationId = "0x" + randomBytes(32).toString("hex");
      const health = {
        sessionId,
        observationId,
        serviceAvailable: !failed,
        ...counts,
      };
      snapshots.set(observationId.slice(2), health);
      return { health, url: `${url}/health/${observationId.slice(2)}` };
    },
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
export async function sendStreamTransaction({
  provider,
  wallet,
  transaction,
  kind,
  persist,
  gate = () => {},
  prepare = async () => {},
  audit,
}) {
  await prepare();
  gate();
  const permission = audit ? await audit.authorize(transaction) : null;
  try {
    // Receipt confirmation can outlive admission. Refresh policy before wallet
    // population/signing, while retaining the exact anchored spend permission.
    await prepare();
    const populated = await wallet.populateTransaction(transaction);
    if (populated.chainId !== CHAIN_ID)
      throw new cli.CliError(
        "WRONG_NETWORK",
        "Refusing to sign outside Sepolia."
      );
    gate();
    if (permission) await permission.assertFresh(populated);
    gate();
    const raw = await wallet.signTransaction(populated),
      hash = keccak256(raw);
    await persist(kind, { state: "submitting", transactionHash: hash });
    if (permission) await permission.submitted(hash);
    gate();
    let receipt;
    try {
      const sent = await provider.broadcastTransaction(raw);
      receipt = await sent.wait(2, 120000);
    } catch {
      throw new cli.CliError(
        "TRANSACTION_UNCERTAIN",
        `${kind} transaction ${hash} needs inspection. Do not automatically repeat funding.`
      );
    }
    if (!receipt || receipt.status !== 1)
      throw new cli.CliError("TRANSACTION_FAILED", `${kind} failed: ${hash}`);
    const record = {
      state: "confirmed",
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
      confirmations: await receipt.confirmations(),
      gasUsed: receipt.gasUsed.toString(),
      feeWei: receipt.fee.toString(),
    };
    await persist(kind, record);
    if (permission) await permission.confirmed(hash);
    return { receipt, record };
  } catch (error) {
    if (permission) await permission.failed();
    throw error;
  }
}
export async function openStream({
  provider,
  wallet,
  quote: q,
  decision,
  config,
  elapsed,
  persist,
  additionalGate = () => {},
  refreshAdmission,
  audit,
}) {
  const gate = () => {
    validateStreamQuote(q, {
      tier: q.tier,
      agent: wallet.address,
      recipient: config.recipient,
      streamAddress: config.streamAddress,
      sessionId: config.sessionId,
    });
    additionalGate();
    if (
      decision.action !== "OPEN" ||
      decision.config.requestId !== config.requestId ||
      JSON.stringify(decision.config) !== JSON.stringify(config) ||
      config.quoteId !== q.id ||
      !same(config.agent, q.agent) ||
      !same(config.token, USDC) ||
      config.amountRaw !== q.amountRaw ||
      config.durationSeconds !== q.durationSeconds ||
      config.streamId !== "0"
    )
      throw new cli.CliError(
        "POLICY_DENIED",
        "Exact OPEN decision required before funding a stream."
      );
    if (BigInt(q.amountRaw) > 10000n)
      throw new cli.CliError(
        "RUN_BUDGET",
        "Maximum stream funding is 0.01 USDC per run."
      );
    const age = elapsed();
    if (!Number.isFinite(age) || age < 0 || age >= 120000)
      throw new cli.CliError(
        "POLICY_EXPIRED",
        "CRE admission decision expired."
      );
  };
  const prepare = async () => {
    try {
      gate();
    } catch (error) {
      if (error.code !== "POLICY_EXPIRED" || !refreshAdmission) throw error;
      // One fresh evaluation, never a reset of the old decision's clock or a
      // retry of a signed transaction. New failures/denials propagate unchanged.
      ({ decision, config, elapsed } = await refreshAdmission());
      gate();
    }
  };
  await prepare();
  await verifyStreamDeployment(provider, q.streamAddress);
  const before = await snapshotWallet(provider, q.agent, q.recipient),
    token = new Contract(USDC, TOKEN_ABI, provider),
    transactions = [];
  if (BigInt(before.agentBalanceRaw) < BigInt(q.amountRaw))
    throw new cli.CliError("BALANCE", "Insufficient test USDC to fund stream.");
  if ((await token.allowance(q.agent, q.streamAddress)) < BigInt(q.amountRaw))
    transactions.push(
      (
        await sendStreamTransaction({
          provider,
          wallet,
          kind: "approval",
          persist,
          gate,
          prepare,
          audit,
          transaction: {
            to: USDC,
            data: tokenIface.encodeFunctionData("approve", [
              q.streamAddress,
              q.amountRaw,
            ]),
          },
        })
      ).record
    );
  const opened = await sendStreamTransaction({
    provider,
    wallet,
    kind: "open",
    persist,
    gate,
    prepare,
    audit,
    transaction: {
      to: q.streamAddress,
      data: iface.encodeFunctionData("createStream", [
        q.recipient,
        q.durationSeconds,
        q.amountRaw,
        metadata(q),
      ]),
    },
  });
  const events = opened.receipt.logs
    .filter((l) => same(l.address, q.streamAddress))
    .map((l) => {
      try {
        return iface.parseLog(l);
      } catch {
        return null;
      }
    })
    .filter((e) => e?.name === "StreamCreated");
  if (events.length !== 1)
    throw new cli.CliError(
      "STREAM_EVENT",
      "Expected exactly one StreamCreated event. Inspect open transaction before retrying."
    );
  const id = events[0].args.streamId.toString();
  await persist("open", { ...opened.record, streamId: id });
  const state = await readStream(
    provider,
    q.streamAddress,
    id,
    opened.receipt.blockNumber
  );
  assertStreamIntent(state, q);
  const after = await snapshotWallet(provider, q.agent, q.recipient);
  if (
    BigInt(before.agentBalanceRaw) - BigInt(after.agentBalanceRaw) !==
      BigInt(q.amountRaw) ||
    before.recipientBalanceRaw !== after.recipientBalanceRaw
  )
    throw new cli.CliError(
      "ESCROW_VERIFICATION",
      "Exact deposit to escrow without recipient payment was not established."
    );
  return {
    streamId: id,
    state,
    before,
    after,
    transactions: [...transactions, opened.record],
    fundedRaw: q.amountRaw,
  };
}
export async function closeStream({
  provider,
  wallet,
  streamAddress,
  streamId,
  persist,
  audit,
}) {
  await verifyStreamDeployment(provider, streamAddress);
  const beforeState = await readStream(provider, streamAddress, streamId);
  if (!same(beforeState.sender, wallet.address))
    throw new cli.CliError(
      "STREAM_OWNER",
      "Only the owning payer may close this demo stream."
    );
  if (!beforeState.isActive)
    throw new cli.CliError("STREAM_CLOSED", "Stream is already closed.");
  const before = await snapshotWallet(
    provider,
    wallet.address,
    beforeState.recipient
  );
  const closed = await sendStreamTransaction({
    provider,
    wallet,
    kind: "close",
    persist,
    audit,
    transaction: {
      to: streamAddress,
      data: iface.encodeFunctionData("cancelStream", [streamId]),
    },
  });
  const events = closed.receipt.logs
    .filter((l) => same(l.address, streamAddress))
    .map((l) => {
      try {
        return iface.parseLog(l);
      } catch {
        return null;
      }
    })
    .filter(
      (e) =>
        e?.name === "StreamCancelled" && e.args.streamId === BigInt(streamId)
    );
  if (events.length !== 1)
    throw new cli.CliError(
      "CLOSE_EVENT",
      "Expected matching StreamCancelled event. Inspect close transaction."
    );
  const e = events[0],
    after = await snapshotWallet(
      provider,
      wallet.address,
      beforeState.recipient
    ),
    state = await readStream(provider, streamAddress, streamId);
  if (
    state.isActive ||
    BigInt(after.agentBalanceRaw) - BigInt(before.agentBalanceRaw) !==
      e.args.senderBalance ||
    BigInt(after.recipientBalanceRaw) - BigInt(before.recipientBalanceRaw) !==
      e.args.recipientBalance ||
    e.args.senderBalance + e.args.recipientBalance !==
      BigInt(beforeState.totalAmount) - BigInt(beforeState.amountWithdrawn)
  )
    throw new cli.CliError(
      "REFUND_VERIFICATION",
      "Stream closure, earnings and refund did not reconcile."
    );
  const result = {
    streamId,
    closed: true,
    earnedRaw: e.args.recipientBalance.toString(),
    refundedRaw: e.args.senderBalance.toString(),
    before,
    after,
    transaction: closed.record,
  };
  await persist("settlement", result);
  return result;
}
