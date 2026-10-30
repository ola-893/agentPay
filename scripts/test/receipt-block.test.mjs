import { test } from "node:test";
import assert from "node:assert/strict";
import { Interface } from "ethers";
import { JOURNAL_ABI, verifyBatchReceipt } from "../../demo/audit/anchor.mjs";

function fixture() {
  const batch = {
    transactionHash: "0x" + "a".repeat(64), root: "0x" + "b".repeat(64),
    address: "0x" + "1".repeat(40), writer: "0x" + "2".repeat(40),
    firstSequence: 96, entries: [{}, {}, {}],
  };
  const iface = new Interface(JOURNAL_ABI);
  const log = iface.encodeEventLog(iface.getEvent("DecisionsAnchored"), [batch.root, 96, 3]);
  const receipt = {
    hash: batch.transactionHash, status: 1, to: batch.address, from: batch.writer,
    blockNumber: 12025428, blockHash: "0x" + "c".repeat(64),
    logs: [{address: batch.address, ...log}], confirmations: async () => 2,
  };
  const provider = {async getBlock(number) {
    assert.equal(number, receipt.blockNumber);
    return {hash: receipt.blockHash};
  }};
  const contract = {async batches(root, options) {
    assert.equal(root, batch.root);
    assert.equal(options.blockTag, receipt.blockNumber, "Never use a possibly lagging latest response");
    return {firstSequence: 96n, count: 3n};
  }};
  return {provider, contract, batch, receipt};
}

test("audit receipt verification binds state and event to its exact canonical confirmed block", async () => {
  const f = fixture();
  assert.equal(await verifyBatchReceipt(f.provider, f.contract, f.batch, f.receipt), 12025428);
});

test("a reorganization before or during the receipt state read fails closed", async () => {
  for (const changeOnRead of [1, 2]) {
    const f = fixture();
    let reads = 0;
    f.provider.getBlock = async () => ({hash: ++reads === changeOnRead ? "0x" + "d".repeat(64) : f.receipt.blockHash});
    await assert.rejects(verifyBatchReceipt(f.provider, f.contract, f.batch, f.receipt), /block changed/);
  }
});

test("wrong receipt, sender, destination, event, state or confirmations cannot authorize signing", async () => {
  const mutations = [
    f => {f.receipt.hash = "0x" + "f".repeat(64);},
    f => {f.receipt.status = 0;},
    f => {f.receipt.confirmations = async () => 1;},
    f => {f.receipt.to = f.batch.writer;},
    f => {f.receipt.from = f.batch.address;},
    f => {f.receipt.logs = [];},
    f => {f.batch.firstSequence++;},
    f => {f.contract.batches = async () => ({firstSequence: 96n, count: 0n});},
  ];
  for (const mutate of mutations) {
    const f = fixture();
    mutate(f);
    await assert.rejects(verifyBatchReceipt(f.provider, f.contract, f.batch, f.receipt));
  }
});
