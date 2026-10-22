import { test } from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eventOutput } from "../../demo/agent/events.mjs";
import { loadProfile, validatePolicy } from "../../demo/agent/profile.mjs";
import { createRunServer, validateRunRequest } from "../../demo/run-server.mjs";
import {
  validateEvent,
  validateRun,
  reduceRun,
} from "../../vite-project/src/lib/run-events.mjs";
const event = (type, data, seq = 1) => ({
  schemaVersion: 1,
  runId: "fixture-run-123",
  seq,
  at: "2026-10-22T11:00:00Z",
  type,
  data,
});
const profile = await loadProfile();
const agent = {
  profile,
  planner: "fixture / test",
  balances: { usdcRaw: "10000", ethRaw: "1000000000000000" },
  payReady: true,
};
const start = event("run.start", {
  mode: "preview",
  profile,
  planner: agent.planner,
  balances: agent.balances,
});
const end = event(
  "run.end",
  {
    status: "denied",
    fundedRaw: "0",
    earnedRaw: "0",
    refundedRaw: "0",
    balances: {},
    transactions: [],
  },
  2
);
const body = {
  profileId: profile.id,
  mode: "preview",
  confirmPay: false,
  policy: profile.policy,
};
test("policy form accepts only bounded existing fields; quote and destinations are not request inputs", () => {
  for (const [field, value] of [
    ["depositCapRaw", "100001"],
    ["depositCapRaw", "0"],
    ["maxRateRawPerSecond", "101"],
    ["maxFeedAgeSeconds", 0],
    ["maxFeedAgeSeconds", 59],
    ["maxPegDeviationBps", 0.1],
    ["maxFailedRequests", 4],
  ])
    assert.throws(() => validatePolicy({ ...profile.policy, [field]: value }));
  assert.throws(() =>
    validatePolicy({ ...profile.policy, recipient: "0x123" })
  );
  assert.equal(
    validatePolicy({ ...profile.policy, depositCapRaw: "9999" }).depositCapRaw,
    "9999"
  );
  assert.throws(() =>
    validateRunRequest({ ...body, quote: { amountRaw: "200000" } }, true, agent)
  );
  assert.throws(
    () =>
      validateRunRequest(
        { ...body, mode: "pay", confirmPay: true },
        false,
        agent
      ),
    /PAY_ENABLED/
  );
  assert.throws(
    () => validateRunRequest({ ...body, mode: "pay" }, true, agent),
    /confirmation/
  );
  assert.throws(
    () =>
      validateRunRequest({ ...body, mode: "pay", confirmPay: true }, true, {
        ...agent,
        payReady: false,
      }),
    /at least/
  );
  assert.equal(
    validateRunRequest({ ...body, mode: "pay", confirmPay: true }, true, agent)
      .mode,
    "pay"
  );
});
test("event validation rejects secrets, absolute paths, invalid amounts, forged explorer links and missing sequence", () => {
  validateRun([start, end]);
  assert.throws(() => validateEvent({ ...start, schemaVersion: 2 }));
  for (const data of [
    { prompt: "private" },
    { configPath: "/Users/private/config.json" },
    { configPath: ".local/../secret.json" },
    { nested: { apiKey: "secret" } },
  ])
    assert.throws(() => validateEvent(event("step.start", data)));
  assert.throws(() =>
    validateEvent(
      event("wallet.tx", {
        kind: "open",
        hash: "0x" + "1".repeat(64),
        status: "confirmed",
        explorerUrl: "https://evil.example",
      })
    )
  );
  assert.throws(() =>
    validateEvent({ ...end, data: { ...end.data, fundedRaw: "0.01" } })
  );
  assert.throws(() => validateRun([start, { ...end, seq: 3 }]));
  assert.throws(() => validateRun([start]));
  assert.throws(
    () =>
      validateEvent(
        event("cre.result", {
          target: "price",
          command: "cre workflow simulate",
          decision: "ALLOW",
          reason: "WITHIN_POLICY",
          hostCheck: true,
          observations: {},
        })
      ),
    /price observations/
  );
  assert.throws(
    () =>
      validateEvent(
        event("api.reuse", {
          streamId: "1",
          successfulRequests: 5,
          failedRequests: 0,
          hostCheckedNoPaymentTransactions: true,
          walletNonceBefore: 5,
          walletNonceAfter: 6,
        })
      ),
    /nonce evidence/
  );
  const emitted = [];
  const adapter = eventOutput(
    { streamRequests() {} },
    (type, data) => emitted.push({ type, data }),
    profile
  );
  adapter.streamRequests({ successfulRequests: 5, failedRequests: 0 }, "7", {
    walletNonceBefore: 5,
    walletNonceAfter: 5,
    hostCheckedNoPaymentTransactions: true,
  });
  assert.equal(emitted[0].data.walletNonceBefore, 5);
  validateEvent(event(emitted[0].type, emitted[0].data));
  validateEvent({
    ...end,
    data: {
      ...end.data,
      status: "failed",
      amountsVerified: false,
      fundedRaw: null,
      earnedRaw: null,
      refundedRaw: null,
    },
  });
});
test("event reducer uses decisions from events, deduplicates SSE replay and retains real amounts", () => {
  let state = reduceRun(undefined, start);
  assert.equal(reduceRun(state, start), state);
  assert.throws(() => reduceRun(state, { ...end, seq: 3 }));
  state = reduceRun(state, end);
  assert.equal(state.status, "denied");
  assert.equal(state.summary.fundedRaw, "0");
  assert.equal(state.events.length, 2);
});
test(
  "local HTTP runner enforces Host, Origin, CSRF, schema, Pay opt-in and single-run lock; SSE replays actual events",
  { timeout: 15000 },
  async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "agentpay-run-server-")
    );
    let finish,
      publish,
      checks = 0;
    const server = createRunServer({
      directory,
      getAgent: async () => agent,
      check: async () => {
        checks++;
      },
      launch: ({ onEvent, onClose }) => {
        publish = onEvent;
        finish = onClose;
        onEvent(start);
      },
      payEnabled: false,
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = {
      origin: "http://127.0.0.1:5317",
      "content-type": "application/json",
    };
    const post = (value, extra = {}) =>
      fetch(base + "/api/runs", {
        method: "POST",
        headers: { ...headers, ...extra },
        body: typeof value === "string" ? value : JSON.stringify(value),
      });
    try {
      assert.equal(
        await new Promise((resolve, reject) => {
          const req = http.get(
            base + "/health",
            { headers: { Host: "evil.example" } },
            (res) => {
              res.resume();
              resolve(res.statusCode);
            }
          );
          req.on("error", reject);
        }),
        403
      );
      assert.equal(
        (
          await fetch(base + "/api/agent", {
            headers: { Origin: "http://evil.example" },
          })
        ).status,
        403
      );
      const response = await (await fetch(base + "/api/agent")).json();
      headers["x-agentpay-token"] = response.token;
      assert.equal(
        (await post(body, { "x-agentpay-token": "wrong" })).status,
        403
      );
      assert.equal(
        (await post(body, { origin: "http://evil.example" })).status,
        403
      );
      assert.equal((await post("{")).status, 400);
      assert.equal(
        (
          await post({
            ...body,
            policy: { ...body.policy, depositCapRaw: "100001" },
          })
        ).status,
        400
      );
      assert.equal(
        (await post({ ...body, mode: "pay", confirmPay: true })).status,
        403
      );
      assert.equal(checks, 0, "Invalid requests must not invoke CRE");
      const accepted = await post(body);
      assert.equal(accepted.status, 202);
      const { id } = await accepted.json();
      assert.equal((await post(body)).status, 409);
      assert.equal(checks, 1);
      publish(end);
      finish(0);
      const text = await (await fetch(base + `/api/runs/${id}/events`)).text();
      assert.ok(text.includes('"type":"run.start"'));
      assert.ok(text.includes('"status":"denied"'));
      assert.equal(
        (await fetch(base + `/api/runs/${id}/artifact?path=.env`)).status,
        404
      );
      assert.equal((await (await fetch(base + "/health")).json()).busy, false);
      const retry = await post(body);
      assert.equal(retry.status, 202);
      publish(end);
      finish(0);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  }
);
