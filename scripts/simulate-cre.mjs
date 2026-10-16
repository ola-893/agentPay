import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const capture = process.argv.includes('--capture');
const scenario = process.argv.includes('--deny-budget') ? 'deny-budget' : 'allow';
const staging = path.join(root, 'cre/payment-guard/config.staging.json');
const config = JSON.parse(await readFile(staging, 'utf8'));
if (scenario === 'deny-budget') config.request.amount = (BigInt(config.request.spendingCap) + 1n).toString();
await mkdir(path.join(root, '.local/cre'), { recursive: true });
const configFile = path.join(root, `.local/cre/${scenario}.config.json`);
await writeFile(configFile, JSON.stringify(config, null, 2) + '\n');
const args = ['workflow', 'simulate', 'payment-guard', '--target', 'staging-settings', '--trigger-index', '0', '--non-interactive', '--config', configFile];
const command = process.env.CRE_BIN || 'cre';
console.log(`Running CRE CLI: ${command} ${args.join(' ')}`);
const child = spawn(command, args, { cwd: path.join(root, 'cre'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
const timeout = setTimeout(() => child.kill('SIGTERM'), 180000);
let code;
try {
  code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
} finally { clearTimeout(timeout); }
if (code !== 0) throw new Error(`CRE simulation failed (exit ${code}); evidence was not updated.`);
const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
const resultLine = clean.split('\n').find((line, i, lines) => line.startsWith('"{') && lines.slice(Math.max(0, i - 2), i).some(s => s.includes('Workflow Simulation Result:')));
if (!resultLine) throw new Error('No complete CRE simulation result found; evidence was not updated.');
const result = JSON.parse(JSON.parse(resultLine));
if (result.workflow !== 'agentpay-payment-guard' || result.chainId !== 11155111 || !result.reportGenerated || result.published) throw new Error('Unexpected simulation result');
if (scenario === 'deny-budget' && (result.approved || result.reason !== 'AMOUNT_EXCEEDS_POLICY')) throw new Error(`Expected a budget rejection; observed ${result.reason}`);
if (scenario === 'allow' && !result.approved) throw new Error(`Live policy rejected the request: ${result.reason}. Review market/feed conditions; do not weaken checks to manufacture approval.`);
const log = clean.split(root).join('<repo>');
const evidence = {
  capturedAt: new Date().toISOString(),
  command: 'cre workflow simulate payment-guard --target staging-settings --trigger-index 0 --non-interactive' + (scenario === 'deny-budget' ? ' --config <deny-budget.config.json>' : ''),
  scenario,
  simulationOnly: true,
  logSha256: createHash('sha256').update(log).digest('hex'),
  configSha256: createHash('sha256').update(await readFile(configFile)).digest('hex'),
  result,
};
await writeFile(path.join(root, `.local/cre/${scenario}.json`), JSON.stringify(evidence, null, 2) + '\n');
if (capture) {
  const directory = path.join(root, 'docs/evidence');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `cre-${scenario}.log`), log);
  await writeFile(path.join(directory, `cre-${scenario}.json`), JSON.stringify(evidence, null, 2) + '\n');
  const publicDir = path.join(root, 'vite-project/public/evidence');
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, `cre-${scenario}.json`), JSON.stringify(evidence, null, 2) + '\n');
}
console.log(`\nVerified ${scenario} simulation. ${capture ? 'Saved submission and frontend evidence.' : 'Saved local evidence under .local/cre.'}`);
