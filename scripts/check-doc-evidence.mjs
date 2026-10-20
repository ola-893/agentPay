import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { AbiCoder, Interface } from "ethers";
import { parseSimulationResult } from "./lib/cre-evidence.mjs";
import { validateResult } from "./lib/cre-validation.mjs";
import { validateEvidence } from "../vite-project/src/lib/evidence.mjs";

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const hash = (text) => createHash("sha256").update(text).digest("hex");
for (const scenario of ["allow", "deny-budget"]) {
  const filename = `cre-${scenario}.json`;
  const raw = read(`docs/evidence/${filename}`);
  const evidence = validateEvidence(JSON.parse(raw), scenario);
  const log = read(`docs/evidence/cre-${scenario}.log`);
  const result = evidence.result;
  assert.equal(hash(log), evidence.logSha256, `${scenario}: transcript hash`);
  assert.deepEqual(
    parseSimulationResult(log),
    result,
    `${scenario}: CLI result differs from JSON`
  );
  assert.equal(
    read(`vite-project/public/evidence/${filename}`),
    raw,
    `${scenario}: frontend copy differs`
  );
  assert.equal(result.mode, "simulation-preview");
  assert.equal(result.published, false);
  assert.equal(result.reportWriteSucceeded, false);
  const config = JSON.parse(read("cre/payment-guard/config.staging.json"));
  if (scenario === "deny-budget")
    config.request.amount = (
      BigInt(config.request.spendingCap) * 2n
    ).toString();
  // This binds current captures to the runner's exact serialized configuration.
  assert.equal(
    hash(JSON.stringify(config, null, 2) + "\n"),
    evidence.configSha256,
    `${scenario}: config changed; recapture or explicitly archive the old evidence`
  );
  const expected = [
    BigInt(result.chainId),
    result.receiverAddress.toLowerCase(),
    result.request.requestId,
    result.request.agent.toLowerCase(),
    result.request.recipient.toLowerCase(),
    result.request.token.toLowerCase(),
    BigInt(result.request.amount),
    BigInt(result.validUntil),
    result.approved,
  ];
  const decoded = [
    ...AbiCoder.defaultAbiCoder().decode(
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
      result.encodedReport
    ),
  ].map((value) => (typeof value === "string" ? value.toLowerCase() : value));
  assert.deepEqual(
    decoded,
    expected,
    `${scenario}: encoded report does not match result (maxAmount is request amount, not policy cap)`
  );
  console.log(
    `Verified ${scenario}: transcript/result/hash/config/public copy/report tuple; historical capture ${evidence.capturedAt}.`
  );
}
const demo = JSON.parse(read("docs/evidence/agent-demo/result.json"));
const payment = JSON.parse(read("docs/evidence/agent-demo/payment.json"));
const rpc = JSON.parse(read("docs/evidence/agent-demo/rpc-verification.json"));
assert.equal(rpc.transaction.hash, payment.receipt.transactionHash);
assert.equal(rpc.receipt.hash, payment.receipt.transactionHash);
assert.equal(rpc.receipt.status, 1);
assert.equal(rpc.chainId, 11155111);
assert.equal(
  rpc.transaction.from.toLowerCase(),
  payment.receipt.from.toLowerCase()
);
assert.equal(
  rpc.transaction.to.toLowerCase(),
  payment.receipt.token.toLowerCase()
);
assert.equal(
  rpc.transaction.data.toLowerCase(),
  new Interface(["function transfer(address,uint256) returns(bool)"])
    .encodeFunctionData("transfer", [payment.receipt.to, 10000n])
    .toLowerCase()
);
assert.equal(rpc.recipientIncreaseRaw, "10000");
assert.equal(
  BigInt(rpc.recipientBalanceAtBlock) - BigInt(rpc.recipientBalanceBeforeBlock),
  10000n
);
assert.equal(demo.provider, "qwen");
assert.equal(demo.mode, "local-agent-payment");
assert.equal(demo.donAuthenticated, false);
assert.equal(demo.strictGuardUsed, false);
assert.equal(demo.paidRaw, "10000");
assert.equal(payment.state, "confirmed");
assert.equal(payment.receipt.status, 1);
assert.ok(payment.receipt.confirmations >= 2);
assert.equal(payment.receipt.amountRaw, "10000");
assert.deepEqual(payment, demo.purchases.basic.payment);
assert.equal(
  BigInt(demo.final.recipientBalanceRaw) -
    BigInt(demo.initial.recipientBalanceRaw),
  10000n
);
assert.equal(
  BigInt(demo.initial.agentBalanceRaw) - BigInt(demo.final.agentBalanceRaw),
  10000n
);
assert.equal(demo.purchases.basic.status, "purchased");
assert.equal(demo.purchases.premium.status, "denied");
assert.equal(demo.purchases.premium.policy.reason, "AMOUNT_EXCEEDS_POLICY");
assert.equal(demo.purchases.premium.noTransactionSigned, true);
assert.deepEqual(demo.purchases.premium.before, demo.purchases.premium.after);
for (const tier of ["basic", "premium"]) {
  const prefix = `docs/evidence/agent-demo/cre-${tier}`;
  const evidence = JSON.parse(read(`${prefix}.json`));
  const configText = read(`${prefix}.config.json`);
  const log = read(`${prefix}.log`);
  const config = JSON.parse(configText);
  assert.equal(hash(configText), evidence.configSha256);
  assert.equal(hash(log), evidence.logSha256);
  assert.deepEqual(parseSimulationResult(log), evidence.result);
  assert.deepEqual(config, evidence.config);
  validateResult(evidence.result, config);
  assert.equal(config.request.agent, demo.payer);
  assert.equal(config.request.recipient, demo.recipient);
  assert.equal(config.request.requestId, demo.purchases[tier].policy.requestId);
  assert.equal(config.request.amount, tier === "basic" ? "10000" : "200000");
  assert.equal(evidence.result.approved, tier === "basic");
}
assert.ok(demo.responses.length >= 2);
assert.ok(demo.responses.every((response) => response.id && response.usage));
console.log(
  "Verified historical AI demo: exact CRE transcripts/configs, model response records, payment/balance and denial consistency."
);
const streamDemo = JSON.parse(read("docs/evidence/stream-demo/result.json"));
const streamRpc = JSON.parse(
  read("docs/evidence/stream-demo/rpc-verification.json")
);
const basic = streamDemo.purchases.basic;
assert.equal(streamDemo.schemaVersion, 2);
assert.equal(streamDemo.mode, "local-agent-stream");
assert.equal(streamDemo.donAuthenticated, false);
assert.equal(basic.status, "stream-completed");
assert.equal(basic.streamId, streamRpc.streamId);
assert.equal(basic.admission, "OPEN");
assert.equal(basic.healthyCheckpoint, "CONTINUE");
assert.equal(basic.outageCheckpoint, "CLOSE");
assert.equal(basic.outageInjected, true);
assert.equal(basic.closedAccessRejected, true);
assert.deepEqual(basic.client, { successfulRequests: 10, failedRequests: 3 });
assert.equal(
  BigInt(streamDemo.earnedRaw) + BigInt(streamDemo.refundedRaw),
  10000n
);
assert.ok(BigInt(streamDemo.refundedRaw) > 0n);
assert.equal(
  BigInt(streamRpc.escrowFundedRaw) - BigInt(streamRpc.escrowBeforeRaw),
  10000n
);
assert.equal(streamRpc.escrowAfterRaw, streamRpc.escrowBeforeRaw);
assert.equal(
  BigInt(streamRpc.recipientAfterRaw) - BigInt(streamRpc.recipientBeforeRaw),
  BigInt(streamDemo.earnedRaw)
);
assert.equal(
  BigInt(streamRpc.payerBeforeRaw) - BigInt(streamRpc.payerAfterRaw),
  BigInt(streamDemo.earnedRaw)
);
assert.equal(streamRpc.closed, true);
assert.equal(streamRpc.open.status, 1);
assert.equal(streamRpc.close.status, 1);
assert.equal(
  streamRpc.open.hash,
  basic.funded.transactions.at(-1).transactionHash
);
assert.equal(
  streamRpc.close.hash,
  basic.settlement.transaction.transactionHash
);
const streamInterface = new Interface([
  "function createStream(address,uint256,uint256,string)",
  "function cancelStream(uint256)",
]);
const openCall = streamInterface.parseTransaction({
  data: streamRpc.openCall.data,
});
assert.equal(openCall.name, "createStream");
assert.equal(
  openCall.args[0].toLowerCase(),
  streamDemo.recipient.toLowerCase()
);
assert.equal(openCall.args[1], 1000n);
assert.equal(openCall.args[2], 10000n);
assert.equal(
  streamInterface.parseTransaction({ data: streamRpc.closeCall.data }).args[0],
  BigInt(basic.streamId)
);
for (const batch of basic.requestBatches) {
  assert.equal(batch.walletNonceBefore, batch.walletNonceAfter);
  assert.equal(batch.noPaymentTransactions, true);
}
assert.equal(
  streamDemo.purchases.premium.policy.reason,
  "AMOUNT_EXCEEDS_POLICY"
);
assert.deepEqual(
  streamDemo.purchases.premium.before,
  streamDemo.purchases.premium.after
);
for (const [label, action] of [
  ["open", "OPEN"],
  ["healthy", "CONTINUE"],
  ["outage", "CLOSE"],
  ["deny", "DENY"],
]) {
  const prefix = `docs/evidence/stream-demo/stream-${label}`;
  const evidence = JSON.parse(read(`${prefix}.json`));
  const config = read(`${prefix}.config.json`),
    log = read(`${prefix}.log`);
  assert.equal(hash(config), evidence.configSha256);
  assert.equal(hash(log), evidence.logSha256);
  const lines = log.split("\n"),
    marker = lines.findIndex((line) =>
      line.includes("Workflow Simulation Result:")
    );
  assert.ok(marker >= 0);
  const outer = JSON.parse(lines.slice(marker + 1).find((line) => line.trim()));
  assert.deepEqual(
    typeof outer === "string" ? JSON.parse(outer) : outer,
    evidence.result
  );
  assert.equal(evidence.result.action, action);
  const checked = spawnSync(
    "bun",
    [
      "scripts/lib/validate-stream-config.ts",
      `${prefix}.config.json`,
      JSON.stringify(evidence.result),
    ],
    { cwd: fileURLToPath(root), encoding: "utf8" }
  );
  assert.equal(checked.status, 0, checked.stderr);
}
console.log(
  "Verified historical stream demo: CRE lifecycle transcripts/policy, escrow, request reuse, closure and refund consistency."
);
console.log(
  `Evidence integrity only; no new signature verification, live CRE execution or public receipt was established by ${fileURLToPath(
    import.meta.url
  )}.`
);
