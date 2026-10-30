import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import cli from "../../scripts/lib/cli.cjs";
import {runCreProcess} from "./cre-process.mjs";
import {
  validateConfig,
  validateResult,
} from "../../scripts/lib/cre-validation.mjs";
import {
  parseSimulationResult,
  stripAnsi,
} from "../../scripts/lib/cre-evidence.mjs";

export async function runCreIntent({ config, root, directory, tier, onStart, onProgress }) {
  await mkdir(directory, { recursive: true });
  const text = JSON.stringify(config, null, 2) + "\n";
  const file = path.join(directory, `cre-${tier}.config.json`);
  await writeFile(file, text);
  await validateConfig(file, root);
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /(?:PRIVATE_KEY(?:_\d+)?|API_KEY|OPEN_AI_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN)$/.test(
        key
      )
    )
      delete env[key];
  // CRE limits ConfigPath to 97 characters; run artifacts may have long absolute paths.
  // CRE resolves --config relative to the workflow directory, not the shell cwd.
  const configArgument = path.relative(
    path.join(root, "cre/payment-guard"),
    file
  );
  const args = [
    "workflow",
    "simulate",
    "payment-guard",
    "--target",
    "staging-settings",
    "--trigger-index",
    "0",
    "--non-interactive",
    "--config",
    configArgument,
  ];
  onStart?.({
    command: [process.env.CRE_BIN || "cre", ...args],
    cwd: "cre",
    configPath: path.relative(root, file),
    transcriptPath: path.relative(
      root,
      path.join(directory, `cre-${tier}.log`)
    ),
  });
  const { output, log } = await runCreProcess({
    root,args,logFile:path.join(directory,`cre-${tier}.log`),onProgress,
    options: {
      cwd: path.join(root, "cre"),
      env,
      quiet: true,
      label: "Agent CRE policy",
      timeoutMs: 180000,
    },
  });
  const result = parseSimulationResult(output);
  validateResult(result, config);
  await validateConfig(file, root, result);
  const evidence = {
    capturedAt: new Date().toISOString(),
    configSha256: createHash("sha256").update(text).digest("hex"),
    logSha256: createHash("sha256").update(log).digest("hex"),
    config,
    result,
  };
  await writeFile(
    path.join(directory, `cre-${tier}.json`),
    JSON.stringify(evidence, null, 2) + "\n"
  );
  return evidence;
}

export async function runStreamCheck({
  config,
  root,
  directory,
  label,
  onStart,
  onProgress,
}) {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `stream-${label}.config.json`),
    serialized = JSON.stringify(config, null, 2) + "\n";
  await writeFile(file, serialized);
  const validator = path.join(root, "scripts/lib/validate-stream-config.ts");
  const validate = async (result) => {
    const checked = await cli.runChild(
      "bun",
      [validator, file, ...(result ? [JSON.stringify(result)] : [])],
      { cwd: root, quiet: true, label: "Stream policy validator" }
    );
    if (checked.code !== 0)
      throw new cli.CliError(
        "STREAM_RESULT_MISMATCH",
        `Stream policy validation failed: ${checked.output.trim()}`
      );
  };
  await validate();
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /(?:PRIVATE_KEY(?:_\d+)?|API_KEY|OPEN_AI_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN|RPC_URL)$/.test(
        key
      )
    )
      delete env[key];
  const args = [
    "workflow",
    "simulate",
    "payment-guard",
    "--target",
    "stream-settings",
    "--trigger-index",
    "0",
    "--non-interactive",
    "--config",
    path.relative(path.join(root, "cre/payment-guard"), file),
  ];
  onStart?.({
    command: [process.env.CRE_BIN || "cre", ...args],
    cwd: "cre",
    configPath: path.relative(root, file),
    transcriptPath: path.relative(
      root,
      path.join(directory, `stream-${label}.log`)
    ),
  });
  const run = await runCreProcess({root,args,logFile:path.join(directory,`stream-${label}.log`),onProgress,options:{
    cwd: path.join(root, "cre"),
    env,
    quiet: true,
    label: "CRE stream supervisor",
    timeoutMs: 180000,
  }});
  const log = run.log;
  const lines = stripAnsi(run.output).split("\n");
  const marker = lines.findIndex((line) =>
    line.includes("Workflow Simulation Result:")
  );
  if (marker < 0)
    throw new cli.CliError(
      "STREAM_RESULT_MISMATCH",
      "CRE returned no complete supervisor result."
    );
  const outer = JSON.parse(lines.slice(marker + 1).find((line) => line.trim()));
  const result = typeof outer === "string" ? JSON.parse(outer) : outer;
  await validate(result);
  const evidence = {
    capturedAt: new Date().toISOString(),
    configSha256: createHash("sha256").update(serialized).digest("hex"),
    logSha256: createHash("sha256").update(log).digest("hex"),
    config,
    result,
  };
  await writeFile(
    path.join(directory, `stream-${label}.json`),
    JSON.stringify(evidence, null, 2) + "\n"
  );
  return evidence;
}
