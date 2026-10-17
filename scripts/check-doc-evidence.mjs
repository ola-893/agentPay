import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { AbiCoder } from "ethers";
import { parseSimulationResult } from "./lib/cre-evidence.mjs";
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
console.log(
  `Evidence integrity only; no signature verification, live CRE execution or public receipt was established by ${fileURLToPath(
    import.meta.url
  )}.`
);
