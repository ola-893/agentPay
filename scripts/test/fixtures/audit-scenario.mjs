import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  ContractFactory,
  Interface,
  id,
} from "ethers";
import { createAuditor } from "../../../demo/audit/controller.mjs";
import { durableWrite, LocalJournal } from "../../../demo/audit/journal.mjs";
import { assertAnchored } from "../../../demo/audit/anchor.mjs";
import {
  sendStreamTransaction,
  openStream,
  closeStream,
  startStreamService,
} from "../../../demo/agent/streams.mjs";
const root = process.cwd(),
  dir = await mkdtemp(path.join(os.tmpdir(), "audit-chain-"));
const socket = net.createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const config = path.join(dir, "hardhat.cjs");
await writeFile(
  config,
  `require(${JSON.stringify(
    path.join(root, "node_modules/@nomicfoundation/hardhat-toolbox")
  )});module.exports={solidity:'0.8.20',networks:{hardhat:{chainId:11155111,mining:{auto:true,interval:100}}}};`
);
const child = spawn(
  "node",
  [
    path.join(root, "node_modules/hardhat/internal/cli/cli.js"),
    "--config",
    config,
    "node",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { stdio: "ignore" }
);
const rpc = new JsonRpcProvider(`http://127.0.0.1:${port}`, undefined, {
  batchMaxCount: 1,
  cacheTimeout: -1,
});
let audit, streamService;
try {
  for (let i = 0; ; i++) {
    try {
      await rpc.getNetwork();
      break;
    } catch (e) {
      if (i > 80) throw e;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  const wallet = new Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      rpc
    ),
    recipient = await (await rpc.getSigner(1)).getAddress();
  const artifact = async (name) =>
    JSON.parse(
      await readFile(
        path.join(root, `artifacts/contracts/${name}.sol/${name}.json`),
        "utf8"
      )
    );
  const tokenArtifact = await artifact("test/DemoUSDC").catch(async () =>
    JSON.parse(
      await readFile(
        path.join(root, "artifacts/contracts/test/DemoUSDC.sol/DemoUSDC.json"),
        "utf8"
      )
    )
  );
  const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  await rpc.send("hardhat_setCode", [usdc, tokenArtifact.deployedBytecode]);
  const token = new Contract(usdc, tokenArtifact.abi, wallet);
  await (await token.mint(wallet.address, 1000000n)).wait(2);
  const streamArtifact = await artifact("AgentPayStream"),
    stream = await new ContractFactory(
      streamArtifact.abi,
      streamArtifact.bytecode,
      wallet
    ).deploy(usdc);
  await stream.deploymentTransaction().wait(2);
  const journalArtifact = await artifact("AgentPayDecisionJournal"),
    journal = await new ContractFactory(
      journalArtifact.abi,
      journalArtifact.bytecode,
      wallet
    ).deploy();
  await journal.deploymentTransaction().wait(2);
  const interrupted = await new LocalJournal(path.join(dir, "journal")).init();
  await interrupted.accept({
    id: "0x" + "7".repeat(64),
    payer: wallet.address,
    kind: "interrupted-test-intent",
  });
  audit = await createAuditor({
    provider: rpc,
    wallet,
    streamAddress: await stream.getAddress(),
    recipients: [recipient],
    directory: path.join(dir, "journal"),
    anchorAddress: await journal.getAddress(),
    anchorEnabled: true,
    offline: true,
    onProgress: () => {},
  });
  const iface = new Interface([
    "function transfer(address,uint256) returns(bool)",
  ]);
  const transaction = (amount) => ({
    to: usdc,
    data: iface.encodeFunctionData("transfer", [recipient, amount]),
  });
  const allowed = await audit.reviewTransaction(transaction(10000));
  assert.equal(allowed.record.decision.action, "ALLOW");
  const denied = await audit.reviewTransaction(transaction(200000));
  assert.equal(denied.record.decision.action, "BLOCK");
  let signedBusiness = 0;
  const sign = wallet.signTransaction.bind(wallet);
  wallet.signTransaction = async (tx) => {
    if (tx.to.toLowerCase() === usdc.toLowerCase()) signedBusiness++;
    return sign(tx);
  };
  await assert.rejects(
    sendStreamTransaction({
      provider: rpc,
      wallet,
      transaction: transaction(200000),
      kind: "blocked",
      persist: async () => {},
      audit,
    }),
    /BLOCK/
  );
  assert.equal(signedBusiness, 0);
  const send = rpc.send.bind(rpc);
  rpc.send = async (method, args) => {
    if (method === "eth_call")
      throw new Error("Injected unavailable RPC (test only)");
    return send(method, args);
  };
  const error = await audit.reviewTransaction(transaction(10000));
  assert.equal(error.record.decision.action, "ERROR");
  rpc.send = send;
  await audit.flush();
  await assertAnchored(
    audit.journal,
    rpc,
    await journal.getAddress(),
    denied.pointer,
    wallet.address
  );
  const before = await token.balanceOf(recipient);
  // Inject a transient RPC error only in the final populated-transaction
  // check, after the original review and receipt have succeeded.
  let recoveredPreSignReads = 0, transferIntentId;
  const retryingAudit = {
    async authorize(tx) {
      const permission = await audit.authorize(tx);
      transferIntentId = permission.intent.id;
      return {
        ...permission,
        async assertFresh(populated) {
          let failOnce = true;
          rpc.send = async (method, args) => {
            if (method === "eth_call" && args[0].data === tx.data && failOnce) {
              failOnce = false;
              recoveredPreSignReads++;
              assert.equal(signedBusiness, 0, "No business signature before successful simulation");
              throw Object.assign(new Error("RPC timeout (test only)"), {code: "TIMEOUT"});
            }
            return send(method, args);
          };
          try { await permission.assertFresh(populated); }
          finally { rpc.send = send; }
        },
      };
    },
  };
  await sendStreamTransaction({
    provider: rpc,
    wallet,
    transaction: transaction(10000),
    kind: "transfer",
    persist: async () => {},
    audit: retryingAudit,
  });
  assert.equal(recoveredPreSignReads, 1);
  assert.equal(signedBusiness, 1);
  assert.equal((await token.balanceOf(recipient)) - before, 10000n);
  const preSignFiles = (await readdir(path.join(dir, "journal/presign")))
    .filter(name => name.startsWith(transferIntentId));
  assert.equal(preSignFiles.length, 3, "Initial check plus failed and recovered final attempts are durable");
  const attempts = await Promise.all(preSignFiles.map(name => readFile(path.join(dir, "journal/presign", name), "utf8").then(JSON.parse)));
  assert.equal(attempts.filter(value => value.observation.status === "success").length, 2);
  assert.equal(attempts.filter(value => value.failure?.errorCode === "RPC_UNAVAILABLE").length, 1);
  streamService = await startStreamService({
    provider: rpc,
    agent: wallet.address,
    recipient,
    streamAddress: await stream.getAddress(),
    sessionId: id("audited-session"),
  });
  const { quote } = await (
    await fetch(streamService.url + "/research/basic")
  ).json();
  const admission = {
    recipient,
    streamAddress: await stream.getAddress(),
    sessionId: quote.sessionId,
    requestId: id("audited-admission"),
    quoteId: quote.id,
    agent: wallet.address,
    token: usdc,
    amountRaw: quote.amountRaw,
    durationSeconds: quote.durationSeconds,
    streamId: "0",
  };
  const opened = await openStream({
    provider: rpc,
    wallet,
    quote,
    decision: { action: "OPEN", config: admission },
    config: admission,
    elapsed: () => 1,
    persist: async () => {},
    audit,
  });
  assert.equal(opened.fundedRaw, "10000");
  await rpc.send("evm_increaseTime", [3]);
  await rpc.send("evm_mine", []);
  const closed = await closeStream({
    provider: rpc,
    wallet,
    streamAddress: await stream.getAddress(),
    streamId: opened.streamId,
    persist: async () => {},
    audit,
  });
  assert.equal(BigInt(closed.earnedRaw) + BigInt(closed.refundedRaw), 10000n);
  const summary = await audit.summary();
  assert.equal(summary.pendingReceipts, 0);
  assert.equal(summary.decisions, 9);
  assert.equal(summary.receiptTransactions.length, 5);
  await audit.flush();
  assert.equal((await audit.summary()).receiptTransactions.length, 5);
  const confirmed = (await audit.journal.status()).batches[0];
  await durableWrite(audit.journal.file("batches", confirmed.root), {
    ...confirmed,
    state: "submitting",
  });
  const nonceBeforeResume = await rpc.getTransactionCount(wallet.address);
  await audit.flush();
  assert.equal(
    await rpc.getTransactionCount(wallet.address),
    nonceBeforeResume,
    "Confirmed outbox must reconcile without another transaction"
  );
  const unknownRoot = "0x" + "9".repeat(64);
  await durableWrite(audit.journal.file("batches", unknownRoot), {
    ...confirmed,
    root: unknownRoot,
    state: "submitting",
  });
  await assert.rejects(audit.flush(), /uncertain/);
  assert.equal(
    await rpc.getTransactionCount(wallet.address),
    nonceBeforeResume,
    "Uncertain submission must not automatically retry"
  );
  console.log("audit scenario passed");
} finally {
  await streamService?.close();
  await audit?.close();
  rpc.destroy();
  child.kill("SIGTERM");
  if (child.exitCode === null) await new Promise((r) => child.once("close", r));
  await rm(dir, { recursive: true, force: true });
}
