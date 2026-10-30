import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { fileURLToPath } from "node:url";
import {
  Interface,
  AbiCoder,
  id,
  JsonRpcProvider,
  Wallet,
  Contract,
} from "ethers";
import cli from "../lib/cli.cjs";
import {
  callModel,
  modelSettings,
  callOpenAI,
  parsePurchaseCall,
  runAgent,
} from "../../demo/agent/model.mjs";
import { runCreIntent } from "../../demo/agent/cre.mjs";
import { createAgentOutput } from "../../demo/agent/output.mjs";
import {
  CHAIN_ID,
  USDC,
  TOKEN_ABI,
  validateQuote,
  assertLocalApproval,
  sendLocalPayment,
  verifyUsdcReceipt,
  startResearchService,
} from "../../demo/agent/payments.mjs";

const agent = "0x0000000000000000000000000000000000000011";
const recipient = "0x0000000000000000000000000000000000000012";
const quote = {
  id: id("agent-demo-test"),
  tier: "basic",
  amount: "10000",
  chainId: Number(CHAIN_ID),
  token: USDC,
  agent,
  recipient,
  blockNumber: 100,
};
const call = (tier) => ({
  type: "function_call",
  call_id: `call-${tier}`,
  name: "buy_research",
  arguments: JSON.stringify({ tier, purpose: "Read the demo research" }),
});
const message = {
  type: "message",
  content: [{ type: "output_text", text: "Basic purchased, premium denied." }],
};
function evidence(approved = true, intent = quote) {
  const config = JSON.parse(
    readFileSync(
      new URL("../../cre/payment-guard/config.staging.json", import.meta.url)
    )
  );
  Object.assign(config.request, {
    requestId: intent.id,
    agent: intent.agent,
    recipient: intent.recipient,
    amount: intent.amount,
  });
  const result = JSON.parse(
    readFileSync(new URL("../../docs/evidence/cre-allow.json", import.meta.url))
  ).result;
  Object.assign(result, {
    request: { ...config.request },
    approved,
    reason: approved ? "WITHIN_POLICY" : "AMOUNT_EXCEEDS_POLICY",
  });
  result.encodedReport = AbiCoder.defaultAbiCoder().encode(
    [
      "uint256",
      "address",
      "bytes32",
      "address",
      "address",
      "address",
      "uint256",
      "uint64",
      "bool",
    ],
    [
      config.chainId,
      config.receiverAddress,
      intent.id,
      intent.agent,
      intent.recipient,
      USDC,
      intent.amount,
      result.validUntil,
      approved,
    ]
  );
  return { config, evidence: { result } };
}
function fixtureProvider(change = {}) {
  const iface = new Interface(TOKEN_ABI);
  const log = iface.encodeEventLog(iface.getEvent("Transfer"), [
    agent,
    recipient,
    10000n,
  ]);
  const receipt = {
    status: 1,
    blockNumber: 101,
    confirmations: async () => 2,
    logs: [{ address: USDC, ...log }],
    ...change.receipt,
  };
  const tx = {
    from: agent,
    to: USDC,
    chainId: CHAIN_ID,
    value: 0n,
    data: iface.encodeFunctionData("transfer", [recipient, 10000n]),
    ...change.tx,
  };
  return {
    getTransactionReceipt: async () => receipt,
    getTransaction: async () => tx,
    getBlockNumber: async () => 100,
  };
}

test("agent CLI help has no credential, network or wallet use and JSON remains one envelope", () => {
  const run = spawnSync(
    process.execPath,
    ["demo/agent-demo.mjs", "--help", "--verbose", "--json"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        OPEN_AI_KEY: "",
        PRIVATE_KEY: "",
        PRIVATE_KEY_1: "",
      },
    }
  );
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.equal(out.command, "demo:agent");
  assert.match(out.data.help, /preview/);
  assert.match(out.data.help, /0.01/);
});
test("preview output cannot present model-invented receipts as verified transactions", () => {
  const recorded = JSON.parse(
    readFileSync(
      new URL("../../docs/evidence/agent-demo/result.json", import.meta.url)
    )
  );
  const result = {
    ...recorded,
    paidRaw: "0",
    final: recorded.initial,
    summary: `Receipt Hash: ${quote.id}`,
    purchases: { ...recorded.purchases, basic: { status: "preview" } },
  };
  const lines = [];
  const output = createAgentOutput({
    stream: { isTTY: false },
    write: (line) => lines.push(line),
  });
  output.response({ id: "hidden-response-id" });
  output.finish(result);
  const text = lines.join("\n");
  assert.match(text, /APPROVED \/ preview only/);
  assert.match(text, /None \/ no tokens transferred/);
  assert.doesNotMatch(text, /Receipt Hash|hidden-response-id|\x1b/);
  assert.equal(text.includes(quote.id), false);
  const verbose = [];
  createAgentOutput({
    verbose: true,
    stream: { isTTY: false },
    write: (line) => verbose.push(line),
  }).finish(result);
  assert.match(verbose.join("\n"), /unverified model text/);
  assert.ok(verbose.join("\n").includes(quote.id));
});
test("failure output suggests recovery only when funding may have been submitted", () => {
  const render = options => {
    const lines = [];
    createAgentOutput({stream: {isTTY: false}, write: line => lines.push(line)})
      .failed(".local/example", options);
    return lines.join(" ");
  };
  assert.match(render({fundingAttempted: false}), /Stopped before stream funding/);
  assert.doesNotMatch(render({fundingAttempted: false}), /recover:guarded-stream/);
  assert.match(render({fundingAttempted: true}), /recover:guarded-stream/);
  assert.match(render(), /recover:guarded-stream/);
});
test("stream output shows recorded CRE observations and limits without claiming onchain CRE enforcement", () => {
  const load = (name) =>
    JSON.parse(
      readFileSync(
        new URL(`../../docs/evidence/stream-demo/${name}.json`, import.meta.url)
      )
    );
  const lines = [];
  const output = createAgentOutput({
    stream: { isTTY: false, columns: 200 },
    verbose: true,
    write: (line) => lines.push(line),
  });
  output.start({
    settings: { provider: "qwen", model: "test" },
    payer: agent,
    recipient,
    balanceRaw: "10000",
  });
  output.priceEvidence(load("cre-price"));
  for (const name of ["open", "healthy", "outage", "deny"])
    output.streamEvidence(load(`stream-${name}`));
  const text = lines.join("\n").replace(/\s+/g, " ");
  for (const value of [
    "Deterministic CRE payment guardrails",
    "Agent proposes work; CRE checks fixed payment rules",
    "Deterministic guardrails / local simulation",
    "CLI checks gate signing of createStream / cancelStream",
    "Contract does not verify CRE results; payer can call it directly",
    "$0.99990138 USDC/USD / finalized read",
    "69050s / maximum 86400s",
    "Each source within 100 bps of $1; disagreement at most 100 bps",
    "block 11956799 / paymentToken(), decimals(), balanceOf(payer)",
    "streams(1) + getClaimableBalance(1)",
    "120 raw claimable / 0 raw withdrawn",
    "10 successes / 3 failures",
    "200000 raw deposit / cap 100000 raw USDC",
    "OPEN",
    "CONTINUE",
    "CLOSE",
    "DENY",
    "amount exceeds policy",
    "None / decision returned to wallet-owning CLI",
  ])
    assert.ok(text.includes(value), `Missing output: ${value}`);
  assert.doesNotMatch(
    text,
    /onchain CRE authorization accepted|\x1b/
  );
  assert.equal(text.replace(/\s+/g, "").includes(load("stream-open").config.healthUrl), true);
  const verbose = [];
  createAgentOutput({
    verbose: true,
    write: (line) => verbose.push(line),
    stream: { isTTY: false },
  }).streamEvidence(load("stream-open"));
  assert.ok(verbose.join("").replace(/\s+/g, "").includes(load("stream-open").logSha256));
});
test("terminal styles never leak to JSON, redirected or NO_COLOR output, and model control sequences are stripped", () => {
  for (const options of [
    {
      stream: { isTTY: true, columns: 44 },
      env: { TERM: "xterm" },
      colored: true,
    },
    { stream: { isTTY: false }, env: { TERM: "xterm" }, colored: false },
    {
      stream: { isTTY: true },
      env: { TERM: "xterm", NO_COLOR: "" },
      colored: false,
    },
    { stream: { isTTY: true }, env: { TERM: "dumb" }, colored: false },
    {
      stream: { isTTY: true },
      env: { TERM: "xterm" },
      json: true,
      colored: false,
    },
  ]) {
    const lines = [];
    const output = createAgentOutput({
      ...options,
      write: (line) => lines.push(line),
    });
    output.requested({
      tier: "basic",
      purpose: "Read research\x1b[2J\x1b]0;untrusted-title\x07",
    });
    const text = lines.join("\n");
    assert.equal(text.includes("\x1b["), options.colored);
    assert.doesNotMatch(text, /\[2J|untrusted-title/);
  }
});
test("OpenAI alias keys are redacted from diagnostic text", () => {
  const previous = process.env.OPEN_AI_KEY;
  process.env.OPEN_AI_KEY = "sensitive-alias-fixture";
  try {
    assert.equal(
      cli
        .redact("key=sensitive-alias-fixture")
        .includes("sensitive-alias-fixture"),
      false
    );
  } finally {
    if (previous === undefined) delete process.env.OPEN_AI_KEY;
    else process.env.OPEN_AI_KEY = previous;
  }
});
test("Responses API uses real strict tools, disables storage and does not expose keys in API errors", async () => {
  let request;
  const result = await callOpenAI({
    apiKey: "private-fixture-key",
    model: "gpt-4.1-mini",
    input: [],
    complete: false,
    fetchImpl: async (url, options) => {
      request = { url, ...options };
      return {
        ok: true,
        json: async () => ({ status: "completed", output: [] }),
      };
    },
  });
  const body = JSON.parse(request.body);
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(body.store, false);
  assert.equal(body.tools[0].strict, true);
  assert.equal(body.parallel_tool_calls, false);
  assert.equal(body.tool_choice, "required");
  assert.equal(result.status, "completed");
  await assert.rejects(
    callOpenAI({
      apiKey: "private-fixture-key",
      model: "x",
      input: [],
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: "invalid_api_key", message: "private-fixture-key" },
        }),
      }),
    }),
    (error) =>
      error.code === "OPENAI_API" &&
      !error.message.includes("private-fixture-key")
  );
});
test("Qwen selection binds credentials to official regional endpoints and never silently falls back", async () => {
  const settings = modelSettings({
    QWEN_API_KEY: "qwen-fixture-key",
    OPENAI_API_KEY: "other-fixture-key",
  });
  assert.equal(settings.provider, "qwen");
  assert.equal(settings.apiKey, "qwen-fixture-key");
  assert.match(settings.endpoint, /dashscope-intl\.aliyuncs\.com/);
  assert.match(
    modelSettings({ QWEN_API_KEY: "x", QWEN_REGION: "virginia" }).endpoint,
    /dashscope-us/
  );
  for (const base of [
    "http://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "https://untrusted.example/compatible-mode/v1",
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1?key=x",
  ])
    assert.throws(
      () => modelSettings({ QWEN_API_KEY: "x", QWEN_BASE_URL: base }),
      { code: "CONFIG" }
    );
  assert.throws(
    () => modelSettings({ AGENTPAY_AI_PROVIDER: "qwen", OPENAI_API_KEY: "x" }),
    { code: "CONFIG" }
  );
  let called = 0;
  await assert.rejects(
    callModel({
      ...settings,
      input: [],
      complete: false,
      fetchImpl: async (url, options) => {
        called++;
        const body = JSON.parse(options.body);
        assert.equal(body.enable_thinking, false);
        assert.equal(body.store, false);
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { code: "invalid_api_key" } }),
        };
      },
    }),
    { code: "QWEN_API" }
  );
  assert.equal(called, 1);
});
test("agent completes both tool-backed journeys and duplicate calls cannot purchase twice", async () => {
  let round = 0;
  const purchased = [];
  const outputs = [
    [call("basic")],
    [call("basic")],
    [call("premium")],
    [message],
  ];
  const result = await runAgent({
    model: "fixture",
    modelCall: async () => ({
      id: `resp-${round}`,
      model: "fixture",
      output: outputs[round++],
    }),
    purchase: async ({ tier }) => {
      purchased.push(tier);
      return { status: tier === "basic" ? "purchased" : "denied" };
    },
  });
  assert.deepEqual(purchased, ["basic", "premium"]);
  assert.equal(result.responses.length, 4);
  assert.equal(result.purchases.premium.status, "denied");
});
test("model refusal, missing tool journeys and unsupported or financial tool arguments cannot silently succeed", async () => {
  for (const item of [
    { ...call("basic"), name: "send_transaction" },
    { ...call("basic"), arguments: "{}" },
    {
      ...call("basic"),
      arguments: JSON.stringify({
        tier: "basic",
        purpose: "x",
        amount: "200000",
      }),
    },
  ])
    assert.throws(() => parsePurchaseCall(item), { code: "AGENT_PROTOCOL" });
  let purchases = 0;
  await assert.rejects(
    runAgent({
      modelCall: async () => ({ output: [message] }),
      purchase: async () => {
        purchases++;
      },
    }),
    { code: "AGENT_INCOMPLETE" }
  );
  assert.equal(purchases, 0);
});
test("quotes bind token, amount, recipient, chain and invoice identifier outside model control", () => {
  validateQuote(quote, { tier: "basic", agent, recipient });
  for (const change of [
    { amount: "200000" },
    { token: agent },
    { recipient: agent },
    { chainId: 1 },
    { id: "bad" },
    { blockNumber: -1 },
  ])
    assert.throws(
      () =>
        validateQuote(
          { ...quote, ...change },
          { tier: "basic", agent, recipient }
        ),
      { code: "QUOTE_MISMATCH" }
    );
});
test("agent CRE runner uses workflow-relative short paths and strips agent credentials", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  await mkdir(path.join(root, ".local/agent-demo/runs"), { recursive: true });
  const directory = await mkdtemp(
    path.join(root, ".local/agent-demo/runs/path-regression-")
  );
  const keys = [
    "CRE_BIN",
    "CLI_FIXTURE",
    "QWEN_API_KEY",
    "PRIVATE_KEY_1",
    "OPEN_AI_KEY",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, {
    CRE_BIN: path.join(root, "scripts/test/fixtures/cre-process.mjs"),
    CLI_FIXTURE: "short-path",
    QWEN_API_KEY: "fixture-secret",
    PRIVATE_KEY_1: "fixture-secret",
    OPEN_AI_KEY: "fixture-secret",
  });
  try {
    let invocation;
    const result = await runCreIntent({
      root,
      directory,
      tier: "basic",
      config: evidence().config,
      onStart: (value) => {
        invocation = value;
      },
    });
    assert.equal(result.result.approved, true);
    assert.deepEqual(invocation, {
      command: [
        process.env.CRE_BIN,
        "workflow",
        "simulate",
        "payment-guard",
        "--target",
        "staging-settings",
        "--trigger-index",
        "0",
        "--non-interactive",
        "--config",
        path.relative(
          path.join(root, "cre/payment-guard"),
          path.join(directory, "cre-basic.config.json")
        ),
      ],
      cwd: "cre",
      configPath: path.relative(
        root,
        path.join(directory, "cre-basic.config.json")
      ),
      transcriptPath: path.relative(
        root,
        path.join(directory, "cre-basic.log")
      ),
    });
    const lines = [];
    createAgentOutput({
      verbose: true,
      stream: { isTTY: false },
      write: (line) => lines.push(line),
    }).creInvocation(invocation);
    const text = lines.join("").replace(/\s+/g, "");
    assert.ok(text.includes(invocation.command.join("").replace(/\s+/g, "")));
    assert.ok(text.includes(invocation.transcriptPath));
  } finally {
    for (const key of keys)
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    await rm(directory, { recursive: true, force: true });
  }
});
test("local payment gate rejects denied, expired, stale and exhausted-budget decisions", () => {
  const allowed = evidence();
  assertLocalApproval(allowed.evidence, allowed.config, { elapsedMs: 1 });
  const denied = evidence(false);
  assert.throws(
    () => assertLocalApproval(denied.evidence, denied.config, { elapsedMs: 1 }),
    { code: "POLICY_DENIED" }
  );
  assert.throws(
    () =>
      assertLocalApproval(allowed.evidence, allowed.config, {
        elapsedMs: allowed.config.authorizationTtlSeconds * 1000,
      }),
    { code: "POLICY_EXPIRED" }
  );
  assert.throws(
    () =>
      assertLocalApproval(allowed.evidence, allowed.config, {
        elapsedMs: 1,
        paidRaw: 1n,
      }),
    { code: "RUN_BUDGET" }
  );
  allowed.evidence.result.feedUpdatedAt =
    allowed.evidence.result.observedAt - allowed.config.maxFeedAgeSeconds;
  assert.throws(
    () =>
      assertLocalApproval(allowed.evidence, allowed.config, {
        elapsedMs: 1000,
      }),
    { code: "POLICY_EXPIRED" }
  );
});
test("denied and substituted payment intents stop before provider access or signing", async () => {
  let signed = 0;
  const wallet = {
    address: agent,
    signTransaction: async () => {
      signed++;
    },
  };
  const denied = evidence(false);
  await assert.rejects(
    sendLocalPayment({
      ...denied,
      provider: {},
      wallet,
      quote,
      elapsed: () => 0,
      paidRaw: 0n,
    }),
    { code: "POLICY_DENIED" }
  );
  const allowed = evidence();
  await assert.rejects(
    sendLocalPayment({
      ...allowed,
      provider: {},
      wallet,
      quote: { ...quote, id: id("another") },
      elapsed: () => 0,
      paidRaw: 0n,
    }),
    { code: "QUOTE_MISMATCH" }
  );
  assert.equal(signed, 0);
});
test("receipt verification requires the exact new confirmed Circle USDC transfer", async () => {
  const hash = id("tx");
  const valid = await verifyUsdcReceipt(fixtureProvider(), hash, quote);
  assert.equal(valid.amountRaw, "10000");
  for (const change of [
    { receipt: { status: 0 } },
    { receipt: { blockNumber: 100 } },
    { receipt: { confirmations: async () => 1 } },
    { receipt: { logs: [] } },
    { tx: { to: recipient } },
    { tx: { from: recipient } },
    { tx: { chainId: 1n } },
    { tx: { value: 1n } },
    { tx: { data: "0x" } },
  ])
    await assert.rejects(
      verifyUsdcReceipt(fixtureProvider(change), hash, quote),
      { code: "INVALID_RECEIPT" }
    );
});
test("paid resource stays locked without a matching onchain receipt", async () => {
  const service = await startResearchService({
    provider: fixtureProvider({ receipt: { status: 0 } }),
    agent,
    recipient,
  });
  try {
    const response = await fetch(service.url + "/research/basic");
    assert.equal(response.status, 402);
    const { quote: q } = await response.json();
    assert.equal(q.amount, "10000");
    const rejected = await fetch(service.url + "/research/basic", {
      headers: { "x-agentpay-payment-tx": id("fake") },
    });
    assert.equal(rejected.status, 422);
    assert.equal((await rejected.json()).research, undefined);
  } finally {
    await service.close();
  }
});

test(
  "local signed payment unlocks only its quoted resource and cannot buy a denied or replayed quote",
  { timeout: 45000 },
  async () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "agentpay-local-payment-")
    );
    const socket = net.createServer();
    await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    const configuration = path.join(directory, "hardhat.config.cjs");
    await writeFile(
      configuration,
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
        configuration,
        "node",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: root, stdio: "ignore" }
    );
    const url = `http://127.0.0.1:${port}`;
    const provider = new JsonRpcProvider(url, undefined, {
      batchMaxCount: 1,
      cacheTimeout: -1,
    });
    let service, other;
    try {
      for (let attempts = 0; ; attempts++) {
        try {
          await provider.getNetwork();
          break;
        } catch (error) {
          if (attempts > 80 || child.exitCode !== null) throw error;
          await new Promise((resolve) => setTimeout(resolve, 50));
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
      // Public Hardhat fixture key. Only this disposable loopback node is used.
      const wallet = new Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
      );
      const target = await (await provider.getSigner(1)).getAddress();
      const token = new Contract(
        USDC,
        artifact.abi,
        await provider.getSigner(0)
      );
      await (await token.mint(wallet.address, 1000000n)).wait(2);
      service = await startResearchService({
        provider,
        agent: wallet.address,
        recipient: target,
      });
      const response = await fetch(service.url + "/research/basic");
      const { quote: q } = await response.json();
      const proof = evidence(true, q);
      const journal = [];
      const paid = await sendLocalPayment({
        ...proof,
        provider,
        wallet,
        quote: q,
        elapsed: () => 1,
        paidRaw: 0n,
        persist: async (entry) => journal.push(entry),
      });
      assert.equal(paid.recipientIncreaseRaw, "10000");
      assert.equal(await token.balanceOf(target), 10000n);
      assert.equal(await token.balanceOf(wallet.address), 990000n);
      assert.deepEqual(
        journal.map((x) => x.state),
        ["submitting", "confirmed"]
      );
      const unlocked = await fetch(service.url + "/research/basic", {
        headers: { "x-agentpay-payment-tx": paid.receipt.transactionHash },
      });
      assert.equal(unlocked.status, 200);
      assert.equal((await unlocked.json()).research.quoteId, q.id);
      const { quote: premium } = await (
        await fetch(service.url + "/research/premium")
      ).json();
      const nonce = await provider.getTransactionCount(
        wallet.address,
        "pending"
      );
      await assert.rejects(
        sendLocalPayment({
          ...evidence(false, premium),
          provider,
          wallet,
          quote: premium,
          elapsed: () => 1,
          paidRaw: 10000n,
          persist: async () =>
            assert.fail("Denied request must not persist a payment"),
        }),
        { code: "POLICY_DENIED" }
      );
      assert.equal(
        await provider.getTransactionCount(wallet.address, "pending"),
        nonce
      );
      const deniedResource = await fetch(service.url + "/research/premium", {
        headers: { "x-agentpay-payment-tx": paid.receipt.transactionHash },
      });
      assert.equal(deniedResource.status, 409);
      other = await startResearchService({
        provider,
        agent: wallet.address,
        recipient: target,
      });
      await fetch(other.url + "/research/basic");
      const replay = await fetch(other.url + "/research/basic", {
        headers: { "x-agentpay-payment-tx": paid.receipt.transactionHash },
      });
      assert.equal(replay.status, 422);
    } finally {
      if (service) await service.close();
      if (other) await other.close();
      provider.destroy();
      child.kill();
      await new Promise((resolve) =>
        child.exitCode !== null ? resolve() : child.once("close", resolve)
      );
      await rm(directory, { recursive: true, force: true });
    }
  }
);
