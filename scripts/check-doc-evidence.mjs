import { readFileSync } from "node:fs";
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
console.log(
  `Evidence integrity only; no signature verification, live CRE execution or public receipt was established by ${fileURLToPath(
    import.meta.url
  )}.`
);
