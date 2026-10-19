import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import cli from "../../scripts/lib/cli.cjs";
import {
  validateConfig,
  validateResult,
} from "../../scripts/lib/cre-validation.mjs";
import {
  parseSimulationResult,
  stripAnsi,
} from "../../scripts/lib/cre-evidence.mjs";

export async function runCreIntent({ config, root, directory, tier }) {
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
  const { code, output } = await cli.runChild(
    process.env.CRE_BIN || "cre",
    args,
    {
      cwd: path.join(root, "cre"),
      env,
      quiet: true,
      label: "Agent CRE policy",
      timeoutMs: 180000,
    }
  );
  const log = stripAnsi(output).split(root).join("<repo>");
  await writeFile(path.join(directory, `cre-${tier}.log`), log);
  if (code !== 0)
    throw new cli.CliError(
      "CRE_FAILED",
      `CRE failed for ${tier} (exit ${code}); no payment was authorized. See the run's CRE transcript.`
    );
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
