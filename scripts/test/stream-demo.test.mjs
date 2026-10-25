import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract, ContractFactory, id } from "ethers";
import {
  USDC,
  STREAM_ABI,
  startStreamService,
  openStream,
  closeStream,
  sessionMessage,
  validateStreamQuote,
} from "../../demo/agent/streams.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
test(
  "real local stream escrow, authenticated request reuse, cancellation earnings and refund reconcile without per-request transactions",
  { timeout: 60000 },
  async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "agentpay-stream-test-")
    );
    const socket = net.createServer();
    await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    const file = path.join(directory, "hardhat.cjs");
    await writeFile(
      file,
      `require(${JSON.stringify(
        path.join(root, "node_modules/@nomicfoundation/hardhat-toolbox")
      )});module.exports={solidity:'0.8.20',networks:{hardhat:{chainId:11155111,allowBlocksWithSameTimestamp:true,mining:{auto:true,interval:100}}},paths:{artifacts:${JSON.stringify(
        path.join(root, "artifacts")
      )},cache:${JSON.stringify(path.join(directory, "cache"))}}};`
    );
    const child = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/hardhat/internal/cli/cli.js"),
        "--config",
        file,
        "node",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: root, stdio: "ignore" }
    );
    const provider = new JsonRpcProvider(
      `http://127.0.0.1:${port}`,
      undefined,
      { batchMaxCount: 1, cacheTimeout: -1 }
    );
    let service;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await provider.getNetwork();
          break;
        } catch (error) {
          if (attempt > 200 || child.exitCode !== null) throw error;
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      const artifact = JSON.parse(
        readFileSync(
          path.join(
            root,
            "artifacts/contracts/test/DemoUSDC.sol/DemoUSDC.json"
          ),
          "utf8"
        )
      );
      await provider.send("hardhat_setCode", [USDC, artifact.deployedBytecode]);
      const signer = await provider.getSigner(0),
        recipient = await (await provider.getSigner(1)).getAddress();
      // Public Hardhat fixture key; this wallet is only connected to the disposable loopback RPC.
      const wallet = new Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
      );
      const token = new Contract(USDC, artifact.abi, signer);
      await (await token.mint(wallet.address, 1000000n)).wait(2);
      const streamArtifact = JSON.parse(
        readFileSync(
          path.join(
            root,
            "artifacts/contracts/AgentPayStream.sol/AgentPayStream.json"
          ),
          "utf8"
        )
      );
      const stream = await new ContractFactory(
        streamArtifact.abi,
        streamArtifact.bytecode,
        signer
      ).deploy(USDC);
      await stream.waitForDeployment();
      const streamAddress = await stream.getAddress(),
        sessionId = id("local-stream-session");
      service = await startStreamService({
        provider,
        agent: wallet.address,
        recipient,
        streamAddress,
        sessionId,
      });
      const endpoint = service.url + "/research/basic";
      const required = await fetch(endpoint);
      assert.equal(required.status, 402);
      const { quote } = await required.json();
      validateStreamQuote(quote, {
        tier: "basic",
        agent: wallet.address,
        recipient,
        streamAddress,
        sessionId,
      });
      await provider.send("evm_increaseTime", [1]);
      await provider.send("evm_mine", []);
      const config = {
        ...JSON.parse(
          readFileSync(
            path.join(root, "cre/payment-guard/config.stream.json"),
            "utf8"
          )
        ),
        agent: wallet.address,
        recipient,
        streamAddress,
        quoteId: quote.id,
        sessionId,
      };
      const journal = [],
        persist = async (kind, data) => journal.push({ kind, ...data });
      // Simulate slow receipt confirmations without waiting two real minutes.
      // Expiry must lead to a new decision, never a longer validity window.
      let age = 1,
        refreshes = 0,
        failedReviews = 0;
      const audit = {
        async authorize() {
          age = 120001;
          return {
            assertFresh: async () => {},
            submitted: async () => {},
            confirmed: async () => {},
            failed: async () => {
              failedReviews++;
            },
          };
        },
      };
      const nonceBeforeRejectedRefresh = await provider.getTransactionCount(
        wallet.address
      );
      for (const refreshAdmission of [
        async () => ({
          config,
          decision: { action: "DENY", config },
          elapsed: () => 1,
        }),
        async () => {
          const swapped = { ...config, recipient: wallet.address };
          return {
            config: swapped,
            decision: { action: "OPEN", config: swapped },
            elapsed: () => 1,
          };
        },
        async () => {
          throw new Error("CRE_REFRESH_UNAVAILABLE");
        },
      ]) {
        age = 1;
        await assert.rejects(
          openStream({
            provider,
            wallet,
            quote,
            config,
            decision: { action: "OPEN", config },
            elapsed: () => age,
            persist: async () => assert.fail("Refused refresh must not sign"),
            audit,
            refreshAdmission,
          }),
          /Exact OPEN|Stream quote|CRE_REFRESH_UNAVAILABLE/
        );
      }
      assert.equal(failedReviews, 3);
      assert.equal(
        await provider.getTransactionCount(wallet.address),
        nonceBeforeRejectedRefresh
      );
      age = 1;
      const funded = await openStream({
        provider,
        wallet,
        quote,
        config,
        decision: { action: "OPEN", config },
        elapsed: () => age,
        persist,
        audit,
        refreshAdmission: async () => {
          refreshes++;
          age = 1;
          const refreshedConfig = {
            ...config,
            requestId: id(`fresh-admission-${refreshes}`),
          };
          return {
            config: refreshedConfig,
            decision: { action: "OPEN", config: refreshedConfig },
            elapsed: () => age,
          };
        },
      });
      assert.equal(
        refreshes,
        2,
        "Approval and creation each refresh after a delayed audit receipt"
      );
      assert.equal(await token.balanceOf(streamAddress), 10000n);
      assert.equal(await token.balanceOf(recipient), 0n);
      assert.equal(await token.balanceOf(wallet.address), 990000n);
      const signature = await wallet.signMessage(
        sessionMessage(service.url, quote, funded.streamId)
      );
      const headers = {
        "x-agentpay-stream-id": funded.streamId,
        "x-agentpay-session-signature": signature,
      };
      const nonce = await provider.getTransactionCount(
        wallet.address,
        "pending"
      );
      for (let n = 0; n < 5; n++) {
        const response = await fetch(endpoint, { headers });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).streamId, funded.streamId);
      }
      assert.equal(
        await provider.getTransactionCount(wallet.address, "pending"),
        nonce
      );
      assert.equal(service.snapshot().health.successfulRequests, 5);
      const thief = Wallet.createRandom();
      const forged = await fetch(endpoint, {
        headers: {
          ...headers,
          "x-agentpay-session-signature": await thief.signMessage(
            sessionMessage(service.url, quote, funded.streamId)
          ),
        },
      });
      assert.equal(forged.status, 401);
      service.injectOutage();
      for (let n = 0; n < 3; n++)
        assert.equal((await fetch(endpoint, { headers })).status, 503);
      const health = service.snapshot();
      assert.equal(health.health.failedRequests, 3);
      assert.equal(health.health.serviceAvailable, false);
      assert.deepEqual(await (await fetch(health.url)).json(), health.health);
      await provider.send("evm_increaseTime", [5]);
      await provider.send("evm_mine", []);
      await assert.rejects(
        closeStream({
          provider,
          wallet: { address: recipient },
          streamAddress,
          streamId: funded.streamId,
          persist,
        }),
        { code: "STREAM_OWNER" }
      );
      const settled = await closeStream({
        provider,
        wallet,
        streamAddress,
        streamId: funded.streamId,
        persist,
      });
      assert.equal(
        BigInt(settled.earnedRaw) + BigInt(settled.refundedRaw),
        10000n
      );
      assert.ok(BigInt(settled.refundedRaw) > 0n);
      assert.ok(BigInt(settled.earnedRaw) > 0n);
      assert.equal(await token.balanceOf(streamAddress), 0n);
      assert.equal(await token.balanceOf(recipient), BigInt(settled.earnedRaw));
      assert.equal(
        await token.balanceOf(wallet.address),
        1000000n - BigInt(settled.earnedRaw)
      );
      assert.equal((await stream.streams(funded.streamId)).isActive, false);
      assert.notEqual((await fetch(endpoint, { headers })).status, 200);
      assert.deepEqual(
        journal.filter((x) => x.state === "submitting").map((x) => x.kind),
        ["approval", "open", "close"]
      );
    } finally {
      if (service) await service.close();
      provider.destroy();
      child.kill();
      await new Promise((r) =>
        child.exitCode !== null ? r() : child.once("close", r)
      );
      await rm(directory, { recursive: true, force: true });
    }
  }
);
test("denied or substituted stream admission stops before any wallet/provider interaction", async () => {
  for (const args of [
    ["--pay", "--close-stream", "1"],
    ["--close-stream", "0"],
    ["--close-stream", (2n ** 256n).toString()],
  ]) {
    const run = spawnSync(
      process.execPath,
      ["demo/agent-demo.mjs", ...args, "--json"],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(run.status, 2);
    assert.equal(JSON.parse(run.stdout).error.code, "USAGE");
  }
  const config = JSON.parse(
    readFileSync(
      path.join(root, "cre/payment-guard/config.stream.json"),
      "utf8"
    )
  );
  const quote = {
    protocol: "agentpay-stream-session-v1",
    id: config.quoteId,
    tier: "basic",
    sessionId: config.sessionId,
    chainId: 11155111,
    token: USDC,
    streamAddress: config.streamAddress,
    agent: config.agent,
    recipient: config.recipient,
    amountRaw: "10000",
    durationSeconds: 1000,
    rateRawPerSecond: "10",
    blockTimestamp: 1,
  };
  for (const decision of [
    { action: "DENY", config },
    { action: "OPEN", config: { ...config, quoteId: id("different") } },
  ])
    await assert.rejects(
      openStream({
        provider: {},
        wallet: { address: config.agent },
        quote,
        config,
        decision,
        elapsed: () => 1,
        persist: async () => assert.fail("Must not sign"),
        refreshAdmission: async () =>
          assert.fail("A denial must not trigger renewal"),
      }),
      { code: "POLICY_DENIED" }
    );
  await assert.rejects(
    openStream({
      provider: {},
      wallet: { address: config.agent },
      quote: { ...quote, amountRaw: "200000" },
      config,
      decision: { action: "OPEN", config },
      elapsed: () => 1,
      persist: async () => {},
    }),
    { code: "QUOTE_MISMATCH" }
  );
  for (const age of [120000, NaN, -1]) {
    let refreshes = 0;
    await assert.rejects(
      openStream({
        provider: {},
        wallet: { address: config.agent },
        quote,
        config,
        decision: { action: "OPEN", config },
        elapsed: () => age,
        persist: async () => assert.fail("Expired approval must not sign"),
        refreshAdmission: async () => {
          refreshes++;
          return {
            config,
            decision: { action: "OPEN", config },
            elapsed: () => age,
          };
        },
      }),
      { code: "POLICY_EXPIRED" }
    );
    assert.equal(
      refreshes,
      1,
      "A still-expired renewal must fail without looping"
    );
  }
});
