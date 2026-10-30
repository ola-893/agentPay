// Presentation QA from original recorded events. Never runs CRE, an LLM or a wallet.
import {readFileSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createAgentOutput} from "../../../demo/agent/output.mjs";
const base = new URL("../../../docs/evidence/cli-rpc-2026-10-30/success/", import.meta.url);
const load = name => JSON.parse(readFileSync(new URL(name, base), "utf8"));
export function renderRecordedOutput({columns = 80, verbose = false, ...options} = {}) {
  const lines = [], result = load("result.json");
  const output = createAgentOutput({pay:true,verbose,stream:{isTTY:false,columns},env:{TERM:"xterm"},
    ...options,write:line=>lines.push(line)});
  const events = readFileSync(new URL("run.ndjson", base), "utf8").trim().split("\n").map(JSON.parse);
  output.preflight();
  for (const {type, data:d} of events) {
    if (type === "run.start") {
      output.start({settings:{provider:result.provider,model:result.model},payer:d.payer,
        recipient:d.recipient,balanceRaw:d.balances.payerUsdcRaw,guarded:d.contractPolicySignatures});
      output.streamContract(result.streamAddress);
    }
    if (type === "step.start" && d.stage === "planner") output.thinking(d.label.includes("summarizing"));
    if (type === "step.start" && d.stage === "request") {
      output.requested({tier:d.tier,purpose:"Recorded request"});
      const c = load(`policy/stream-${d.tier === "basic" ? "open" : "deny"}.json`).config;
      output.streamQuote({...c,rateRawPerSecond:String(BigInt(c.amountRaw)/BigInt(c.durationSeconds))});
    }
    if (type === "step.start" && d.stage === "cre") {
      const invocation = {...d,command:d.command.split(" ")};
      if (d.label.includes("risk-scoring")) output.spendReview({phase:"start",invocation:{...invocation,command:d.command}});
      else {
        const filename = path.basename(d.configPath);
        const label = filename.startsWith("cre-price") ? "USDC price safety" : filename.replace("stream-", "").replace(".config.json", "");
        output.streamChecking(label);
        output.creInvocation(invocation);
      }
    }
    if (type === "cre.result") {
      if (d.target === "spend") output.spendReview({phase:"result",record:d.observations});
      else {
        const evidence = load("policy/"+path.basename(d.configPath).replace(".config.json", ".json"));
        if (d.target === "price") output.priceEvidence(evidence);
        else output.streamEvidence(evidence);
      }
      if (d.decision === "DENY") output.denied();
    }
    if (type === "audit.receipt") output.auditReceipt({transactionHash:d.hash,entries:Array(d.count)});
    if (type === "wallet.tx" && d.status === "submitting") output.streamTransaction(d.kind,{transactionHash:d.hash});
    if (type === "stream.opened") output.streamOpened(d);
    if (type === "api.reuse") output.streamRequests(d,d.streamId);
    if (type === "fault") output.streamOutage();
    if (type === "stream.closed") output.streamClosed(d);
    if (type === "run.end") output.finish(result);
  }
  output.dispose();
  return lines.join("\n")+"\n";
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log("RECORDED PRESENTATION PREVIEW / October 30, stream #5");
  console.log("No new model calls, CRE execution or transactions.\n");
  process.stdout.write(renderRecordedOutput({columns:Number(process.argv[2]) || 80,verbose:process.argv.includes("--verbose")}));
}
