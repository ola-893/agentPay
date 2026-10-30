import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPreSignSimulation } from "../../demo/audit/presign.mjs";
import { simulateIntent } from "../../demo/audit/service.mjs";

const block = { number: 42, hash: "0x" + "a".repeat(64) };
const intent = {
  payer: "0x" + "1".repeat(40),
  transaction: { to: "0x" + "2".repeat(40), data: "0x12345678", value: "0" },
};
function fixture(inject = () => {}) {
  const calls = [], attempts = [], waits = [], retries = [];
  let latestReads = 0;
  const provider = {
    async getBlock(tag) {
      if (tag === "latest") latestReads++;
      return { ...block };
    },
    async send(method, params) {
      calls.push({ method, params: structuredClone(params) });
      await inject(method, calls);
      assert.ok(["eth_call", "eth_estimateGas"].includes(method), "Only read-only RPCs allowed");
      return method === "eth_call" ? "0x" : "0x10000";
    },
  };
  const options = {
    provider, intent, assertIntent() {},
    onAttempt: async value => attempts.push(value),
    onRetry: value => retries.push(value),
    wait: async value => waits.push(value),
  };
  return { provider, options, calls, attempts, waits, retries, latestReads: () => latestReads };
}
const unavailable = () => Object.assign(new Error("https://secret-endpoint/API_KEY private payload"), {
  code: "CALL_EXCEPTION", shortMessage: "missing revert data",
  info: { error: { code: -32005, message: "rate limit exceeded" } },
});

test("final simulation retries transient reads with identical calldata, saving every attempt", async () => {
  for (const failingMethod of ["eth_call", "eth_estimateGas"]) {
    let failures = 1;
    const f = fixture(method => { if (method === failingMethod && failures-- > 0) throw unavailable(); });
    const result = await checkPreSignSimulation(f.options);
    assert.equal(result.status, "success");
    assert.equal(f.latestReads(), 2);
    assert.deepEqual(f.retries, [2]);
    assert.deepEqual(f.waits, [200]);
    assert.equal(f.attempts.length, 2);
    assert.equal(f.attempts[0].failure.operation, failingMethod);
    assert.equal(f.attempts[0].failure.rpcCode, -32005);
    assert.equal(f.attempts[0].observation.status, "unavailable");
    assert.doesNotMatch(JSON.stringify(f.attempts), /secret-endpoint|API_KEY|private payload|rate limit/);
    for (const call of f.calls) assert.deepEqual(call.params, [{
      from: intent.payer, to: intent.transaction.to, data: intent.transaction.data, value: "0x0",
    }, "0x2a"]);
  }
});

test("unavailable final simulation fails closed after three read-only attempts", async () => {
  const f = fixture(() => { throw unavailable(); });
  await assert.rejects(checkPreSignSimulation(f.options), { code: "PRESIGN_RPC_UNAVAILABLE" });
  assert.equal(f.attempts.length, 3);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.waits, [200, 400]);
});

test("EVM reverts stop immediately, including wrapped errors with revert data", async () => {
  for (const error of [
    Object.assign(new Error("execution reverted: no permission"), { code: "CALL_EXCEPTION" }),
    Object.assign(new Error("call failed"), { code: "CALL_EXCEPTION", data: "0x12345678" }),
    Object.assign(new Error("request failed"), { info: { error: { code: 3, message: "rejected" } } }),
  ]) {
    const f = fixture(() => { throw error; });
    await assert.rejects(checkPreSignSimulation(f.options), { code: "PRESIGN_SIMULATION_REVERTED" });
    assert.equal(f.attempts.length, 1);
    assert.equal(f.attempts[0].observation.status, "reverted");
    assert.deepEqual(f.waits, []);
  }
});

test("a changed block stops immediately before signing", async () => {
  const f = fixture();
  f.provider.getBlock = async tag => tag === "latest" ? block : { ...block, hash: "0x" + "b".repeat(64) };
  await assert.rejects(checkPreSignSimulation(f.options), { code: "PRESIGN_BLOCK_CHANGED" });
  assert.equal(f.attempts.length, 1);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.waits, []);
});

test("expiry or mutation during a read-only retry stops the next attempt", async () => {
  for (const code of ["PRESIGN_INTENT_EXPIRED", "PRESIGN_INTENT_CHANGED"]) {
    const f = fixture(() => { throw unavailable(); });
    let expired = false;
    f.options.wait = async () => { expired = true; };
    f.options.assertIntent = () => { if (expired) throw Object.assign(new Error("invalid intent"), { code }); };
    await assert.rejects(checkPreSignSimulation(f.options), { code });
    assert.equal(f.calls.length, 1);
    assert.equal(f.attempts.length, 1);
  }
});

test("expiry after a successful RPC and a failed evidence write both stop signing", async () => {
  const f = fixture();
  f.options.assertIntent = () => { if (f.attempts.length) throw new Error("expired after RPC"); };
  await assert.rejects(checkPreSignSimulation(f.options), /expired after RPC/);
  const storage = fixture();
  storage.options.onAttempt = async () => { throw new Error("disk full"); };
  await assert.rejects(checkPreSignSimulation(storage.options), /disk full/);
  assert.equal(storage.latestReads(), 1);
  assert.deepEqual(storage.waits, []);
});

test("latest-block RPC failures are bounded and an initial CRE observation is never retried", async () => {
  const f = fixture();
  f.provider.getBlock = async () => { throw unavailable(); };
  await assert.rejects(checkPreSignSimulation(f.options), { code: "PRESIGN_RPC_UNAVAILABLE" });
  assert.equal(f.attempts.length, 3);
  assert.equal(f.attempts[0].failure.operation, "block-read");
  assert.equal(f.calls.length, 0);
  const initial = fixture(() => { throw unavailable(); });
  assert.equal((await simulateIntent(initial.provider, intent, block)).status, "unavailable");
  assert.equal(initial.calls.length, 1);
});
