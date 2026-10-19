#!/usr/bin/env node
// Fake CRE subprocess for host-wrapper regression tests, never submission evidence.
import { readFileSync } from "node:fs";
import path from "node:path";
import { AbiCoder } from "ethers";
const configArgument = process.argv[process.argv.indexOf("--config") + 1];
if (
  process.env.CLI_FIXTURE === "short-path" &&
  (path.isAbsolute(configArgument) ||
    configArgument.length > 97 ||
    process.env.QWEN_API_KEY ||
    process.env.PRIVATE_KEY_1 ||
    process.env.OPEN_AI_KEY)
) {
  console.error("fixture: invalid config path or leaked agent credentials");
  process.exit(9);
}
const config = JSON.parse(
  readFileSync(
    process.env.CLI_FIXTURE === "short-path"
      ? path.resolve("payment-guard", configArgument)
      : configArgument,
    "utf8"
  )
);
if (process.env.CLI_FIXTURE === "fail") {
  console.error("fixture: authentication unavailable");
  process.exit(7);
}
if (process.env.CRE_ETH_PRIVATE_KEY) {
  console.error("fixture: signing key leaked into preview child");
  process.exit(9);
}
const template = JSON.parse(
  readFileSync(
    new URL("../../../docs/evidence/cre-allow.json", import.meta.url)
  )
).result;
const approved =
  BigInt(config.request.amount) <= BigInt(config.request.spendingCap);
const now = 2000000000;
const result = {
  ...template,
  mode: config.publishReport ? "report-write" : "simulation-preview",
  reportWriteSucceeded: config.publishReport,
  request: config.request,
  receiverAddress: config.receiverAddress,
  externalPriceUsd8: "100000000",
  chainlinkPriceUsd8: "99990000",
  feedRoundId: "1",
  observedAt: now,
  feedUpdatedAt: now - 100,
  validUntil: now + config.authorizationTtlSeconds,
  approved,
  reason: approved ? "WITHIN_POLICY" : "AMOUNT_EXCEEDS_POLICY",
};
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
    11155111,
    config.receiverAddress,
    config.request.requestId,
    config.request.agent,
    config.request.recipient,
    config.request.token,
    BigInt(config.request.amount),
    BigInt(result.validUntil),
    approved,
  ]
);
if (process.env.CLI_FIXTURE === "corrupt")
  result.request = { ...result.request, amount: "99999" };
if (process.env.CLI_FIXTURE === "stale") result.feedUpdatedAt = now - 86401;
console.log("fixture: synthetic wrapper test only");
console.log(
  "Workflow Simulation Result:\n" + JSON.stringify(JSON.stringify(result))
);
