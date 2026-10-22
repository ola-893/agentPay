import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  deriveDiagramState,
  formatUsdc,
  formatEth,
  formatPrice,
  toRawUsdc,
  shortAddress,
  percentOf,
  eventNodes,
  timelinePresentation,
} from "../../vite-project/src/lib/workflow-view.mjs";
const directory = new URL("../../vite-project/public/runs/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", directory)));
async function capture(item) {
  return (await readFile(new URL(item.file, directory), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
}
const pay = await capture(index.runs.find((x) => x.mode === "pay"));
test("diagram starts empty, shows actual escrow funding mid-run, and settles from the recorded events", () => {
  const idle = deriveDiagramState([]);
  assert.equal(idle.status, "idle");
  assert.equal(idle.decision, null);
  assert.equal(idle.fundedRaw, null);
  assert.equal(idle.successfulRequests, null);
  const position = pay.findIndex((e) => e.type === "stream.opened");
  const mid = deriveDiagramState(pay.slice(0, position + 1));
  assert.equal(mid.status, "running");
  assert.equal(mid.fundedRaw, "10000");
  assert.equal(mid.closed, false);
  assert.equal(mid.earnedRaw, null);
  const done = deriveDiagramState(pay);
  assert.equal(done.status, "completed");
  assert.equal(done.closed, true);
  assert.equal(done.fundedRaw, pay.at(-1).data.fundedRaw);
  assert.equal(done.earnedRaw, "960");
  assert.equal(done.refundedRaw, "9040");
  assert.equal(done.successfulRequests, 10);
  assert.equal(done.faultStatus, 503);
  assert.equal(done.service, "outage");
  assert.equal(done.transactions.length, 3);
  assert.equal(done.auditReceipts.length, 4);
  assert.equal(
    done.reuseTransactions,
    null,
    "Older capture has no nonce event evidence; do not manufacture 0 txs"
  );
});
test("DENY and preview projection never invent a funded stream or paid calls", async () => {
  for (const item of index.runs.filter((x) => x.mode === "preview")) {
    const events = await capture(item),
      state = deriveDiagramState(events);
    assert.equal(state.status, item.preset ? "denied" : "completed");
    if (item.preset) assert.equal(state.decision, "DENY");
    assert.equal(state.fundedRaw, "0");
    assert.equal(state.closed, false);
    assert.equal(state.successfulRequests, null);
    assert.equal(state.reuseTransactions, null);
    assert.equal(state.transaction, null);
  }
});
test("diagram copies decisions without evaluating prices, handles missing evidence, deduplicates hashes and hides unverified amounts", () => {
  const e = (type, data, seq = 1) => ({ type, data, seq });
  const result = deriveDiagramState([
    e("cre.result", { target: "price", decision: "DENY", observations: {} }),
    e("api.reuse", { successfulRequests: 5, failedRequests: 0 }, 2),
  ]);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reuseTransactions, null);
  assert.equal(
    deriveDiagramState([
      e("api.reuse", {
        successfulRequests: 5,
        failedRequests: 0,
        hostCheckedNoPaymentTransactions: true,
        walletNonceBefore: 9,
        walletNonceAfter: 9,
      }),
    ]).reuseTransactions,
    0
  );
  assert.equal(
    deriveDiagramState([
      e("cre.result", {
        target: "stream",
        decision: "CLOSE",
        observations: { health: { serviceAvailable: false } },
      }),
    ]).faultStatus,
    null
  );
  const hash = "0x" + "1".repeat(64);
  const state = deriveDiagramState([
    e("wallet.tx", { hash, kind: "open", status: "submitting" }),
    e("wallet.tx", { hash, kind: "open", status: "confirmed" }, 2),
    e(
      "run.end",
      {
        status: "failed",
        amountsVerified: false,
        fundedRaw: "10000",
        earnedRaw: null,
        refundedRaw: null,
      },
      3
    ),
  ]);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transaction.status, "confirmed");
  assert.equal(state.packet, null);
  assert.equal(state.fundedRaw, null);
  assert.equal(state.unverified, true);
});
test("token and price formatters use integer math, preserve USDC precision and truncate ETH to four decimals", () => {
  assert.equal(formatUsdc("840"), "0.00084 USDC");
  assert.equal(formatUsdc("10000"), "0.01 USDC");
  assert.equal(
    formatUsdc("900719925474099312345678"),
    "900719925474099312.345678 USDC"
  );
  assert.equal(formatUsdc(null), "—");
  assert.equal(formatEth(null), "—");
  assert.equal(formatEth("1999999999999999999"), "1.9999 ETH");
  assert.equal(formatEth("9007199254740993123456789"), "9007199.2547 ETH");
  assert.equal(formatEth("1"), "0.0000 ETH");
  assert.equal(formatPrice("99990493"), "0.99990");
  assert.equal(formatPrice("100000000"), "1.00000");
  assert.equal(toRawUsdc("0.01"), "10000");
  assert.equal(toRawUsdc("0.000001"), "1");
  assert.equal(toRawUsdc("0."), "0");
  assert.equal(
    toRawUsdc("900719925474099312.345678"),
    "900719925474099312345678"
  );
  for (const bad of ["1e-6", "-1", "0.0000001", "", "NaN", " 1", "00.1"])
    assert.throws(() => toRawUsdc(bad));
  assert.equal(percentOf("960", "10000"), "9.6%");
  assert.equal(percentOf("9040", "10000"), "90.4%");
  assert.equal(percentOf(null, "10000"), "0%");
  assert.equal(
    shortAddress("0xe26468ae02368a75DBDBea58F367B7313942ad26"),
    "0xe264…ad26"
  );
});
test("every recorded timeline title stays compact and nodes point back to source events", async () => {
  for (const item of index.runs)
    for (const event of await capture(item)) {
      assert.ok(eventNodes(event).length);
      if (["run.start", "run.end"].includes(event.type)) continue;
      const row = timelinePresentation(event);
      assert.ok(row.title.trim().split(/\s+/).length <= 6, row.title);
      if (event.type === "cre.result")
        assert.equal(row.chip, event.data.decision);
    }
});
