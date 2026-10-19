import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cli from './lib/cli.cjs';
import { validateConfig, validateResult } from './lib/cre-validation.mjs';
import {
  parseSimulationResult,
  backupEvidence,
  stripAnsi,
} from './lib/cre-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await cli.cliMain(
  'cre:simulate',
  { capture: 'boolean', 'deny-budget': 'boolean' },
  `Usage: npm run --silent cre:simulate -- [--deny-budget] [--capture] [--json]
Run the live Sepolia USDC preview (6 decimals); no broadcast or payment.
Default: request 10000 (0.01 USDC), cap 100000 (0.1 USDC).
--deny-budget  Request twice the cap; expected DENY is success (exit 0).
--capture      Back up and replace repository/frontend evidence after verification.
--json         One schemaVersion=1 envelope on stdout; progress on stderr.
--help         Show help without loading config, credentials or networking.
Requires Bun, CRE login/account access, Coinbase and Sepolia RPC connectivity.
Exit: 0 expected decision; 1 execution/validation failure; 2 usage/config error; 130/143 interrupted.`,
  async ({ flags }) => {
    const capture = flags.capture === true;
    const scenario = flags['deny-budget'] ? 'deny-budget' : 'allow';
    const staging = path.join(root, 'cre/payment-guard/config.staging.json');
    let config;
    try {
      config = JSON.parse(await readFile(staging, 'utf8'));
    } catch {
      throw new cli.CliError(
        'CONFIG',
        'CRE staging config must exist and contain valid JSON.',
        2
      );
    }
    if (config.publishReport)
      throw new cli.CliError(
        'CONFIG',
        'The read-only runner requires publishReport=false. Use the explicit cre:simulate:write path for report writes.',
        2
      );
    if (scenario === 'deny-budget') {
      try {
        config.request.amount = (
          BigInt(config.request.spendingCap) * 2n
        ).toString();
      } catch {
        throw new cli.CliError(
          'CONFIG',
          'request.spendingCap must be a positive uint256 integer string.',
          2
        );
      }
    }
    await mkdir(path.join(root, '.local/cre'), { recursive: true });
    const configFile = path.join(root, `.local/cre/${scenario}.config.json`);
    await writeFile(configFile, JSON.stringify(config, null, 2) + '\n');
    const args = [
      'workflow',
      'simulate',
      'payment-guard',
      '--target',
      'staging-settings',
      '--trigger-index',
      '0',
      '--non-interactive',
      '--config',
      configFile,
    ];
    const command = process.env.CRE_BIN || 'cre';
    console.log(`Running CRE CLI: ${command} ${args.join(' ')}`);
    await validateConfig(configFile, root);
    const env = { ...process.env };
    delete env.CRE_ETH_PRIVATE_KEY;
    const { code, output } = await cli.runChild(command, args, {
      cwd: path.join(root, 'cre'),
      env,
      label: 'CRE simulation',
    });
    if (code !== 0)
      throw new cli.CliError(
        'SIMULATION_FAILED',
        `CRE simulation failed (exit ${code}); evidence was not updated.`
      );
    const clean = stripAnsi(output);
    const result = parseSimulationResult(output);
    validateResult(result, config);
    await validateConfig(configFile, root, result);
    if (
      scenario === 'deny-budget' &&
      (result.approved || result.reason !== 'AMOUNT_EXCEEDS_POLICY')
    )
      throw new Error(`Expected a budget rejection; observed ${result.reason}`);
    if (
      scenario === 'allow' &&
      (!result.approved || result.reason !== 'WITHIN_POLICY')
    )
      throw new Error(
        `Live policy rejected the request: ${result.reason}. Review market/feed conditions; do not weaken checks to manufacture approval.`
      );
    const log = clean.split(root).join('<repo>');
    const evidence = {
      capturedAt: new Date().toISOString(),
      command:
        'cre workflow simulate payment-guard --target staging-settings --trigger-index 0 --non-interactive' +
        (scenario === 'deny-budget'
          ? ' --config <deny-budget.config.json>'
          : ''),
      scenario,
      simulationOnly: true,
      logSha256: createHash('sha256').update(log).digest('hex'),
      configSha256: createHash('sha256')
        .update(await readFile(configFile))
        .digest('hex'),
      result,
    };
    await writeFile(
      path.join(root, `.local/cre/${scenario}.json`),
      JSON.stringify(evidence, null, 2) + '\n'
    );
    if (capture) {
      const backup = await backupEvidence(root, scenario);
      if (backup)
        console.log(
          `Previous evidence retained: ${path.relative(root, backup)}`
        );
      const directory = path.join(root, 'docs/evidence');
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, `cre-${scenario}.log`), log);
      await writeFile(
        path.join(directory, `cre-${scenario}.json`),
        JSON.stringify(evidence, null, 2) + '\n'
      );
      const publicDir = path.join(root, 'vite-project/public/evidence');
      await mkdir(publicDir, { recursive: true });
      await writeFile(
        path.join(publicDir, `cre-${scenario}.json`),
        JSON.stringify(evidence, null, 2) + '\n'
      );
    }
    console.log(
      `\nVerified ${scenario} simulation. ${
        capture
          ? 'Saved submission and frontend evidence.'
          : 'Saved local evidence under .local/cre.'
      }`
    );

    return evidence;
  }
);
