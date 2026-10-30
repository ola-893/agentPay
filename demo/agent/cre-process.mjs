import path from "node:path";
import {writeFile} from "node:fs/promises";
import {performance} from "node:perf_hooks";
import cli from "../../scripts/lib/cli.cjs";
import {stripAnsi} from "../../scripts/lib/cre-evidence.mjs";

export function creAuthFailure(output) {
  const text = stripAnsi(output);
  // Never retry execution, results, policy denials or errors reported by a workflow.
  if (/Workflow Simulation|Workflow compiled|Compiled workflow|Compiling|Running (?:workflow|simulation)|Executing (?:workflow|simulation)|Simulation (?:started|running)|USER LOG/i.test(text)) return null;
  if (/credential validation failed/i.test(text) && /unable to retrieve organization info/i.test(text)) return "CRE_ACCOUNT_UNAVAILABLE";
  if (/authentication required|you are not logged in|failed to load credentials|credential validation failed/i.test(text)) return "CRE_AUTH_REQUIRED";
  return null;
}
export function creFailure(code, transcript) {
  const message = code === "CRE_ACCOUNT_UNAVAILABLE"
    ? "Chainlink CRE could not verify your account/organization. Run cre whoami. If credentials are invalid, run cre login; otherwise wait and retry."
    : code === "CRE_AUTH_REQUIRED"
    ? "Chainlink CRE authentication is required. Run cre whoami, then cre login if the session is invalid."
    : "CRE execution failed; no successful workflow result was accepted.";
  return new cli.CliError(code, `${message} Transcript: ${transcript}`);
}
export async function runCreProcess({root,logFile,args,options,onProgress = () => {},
  run = cli.runChild,wait = ms => new Promise(resolve => setTimeout(resolve,ms)),now = () => performance.now()}) {
  const started = now(), budget = options.timeoutMs ?? 180000;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = Math.floor(budget - (now() - started));
    if (remaining <= 0)
      throw new cli.CliError("TIMEOUT",`CRE invocation time budget expired before retry. Transcript: ${path.relative(root,logFile)}`);
    const result = await run(process.env.CRE_BIN || "cre",args,{...options,timeoutMs:remaining});
    const log = cli.redact(stripAnsi(result.output)).split(root).join("<repo>");
    await writeFile(logFile,log);
    if (result.code === 0) return {...result,log};
    const code = creAuthFailure(log);
    if (code) await writeFile(logFile.replace(/\.log$/,`.attempt-${attempt}.log`),log);
    if (code === "CRE_ACCOUNT_UNAVAILABLE" && attempt === 1 && now() - started + 750 < budget) {
      onProgress("CRE account lookup failed before workflow execution; retrying once (2/2). No decision accepted.");
      await wait(750);
      continue;
    }
    throw creFailure(code || "CRE_FAILED",path.relative(root,logFile));
  }
}
