import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSimulationResult, recordingReadiness, stripAnsi } from './lib/cre-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windowArg = process.argv.find(a => a.startsWith('--recording-window='));
const recordingWindowSeconds = windowArg ? Number(windowArg.split('=')[1]) : 600;
if (!Number.isSafeInteger(recordingWindowSeconds) || recordingWindowSeconds <= 0 || recordingWindowSeconds > 3600) throw new Error('Recording window must be an integer from 1 to 3600 seconds');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const directory = path.join(root, process.argv.includes('--save-evidence') ? 'docs/evidence/preflight' : '.local/cre/preflight', stamp);
await mkdir(directory, { recursive: true });
const results = [];
for (const scenario of ['allow', 'deny-budget']) {
  const args = ['run', 'cre:simulate', ...(scenario === 'deny-budget' ? ['--', '--deny-budget'] : [])];
  console.log(`\n$ npm ${args.join(' ')}\n`);
  const child = spawn(process.env.npm_execpath ? process.execPath : 'npm', process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args,
    { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
  const timeout = setTimeout(() => child.kill('SIGTERM'), 200000);
  let code;
  try { code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }); }
  finally { clearTimeout(timeout); }
  const entry = { scenario, command: `npm ${args.join(' ')}`, exitCode: code };
  try {
    const result = parseSimulationResult(output);
    Object.assign(entry, recordingReadiness(result, scenario, recordingWindowSeconds), { result });
    entry.ready = entry.ready && code === 0;
  } catch (error) { Object.assign(entry, { ready: false, reason: error.message }); }
  await writeFile(path.join(directory, `${scenario}.log`), stripAnsi(output).split(root).join('<repo>'));
  results.push(entry);
}
const summary = { checkedAt: new Date().toISOString(), recordingWindowSeconds,
  ready: results.every(r => r.ready), results,
  note: 'Readiness describes this dry run only. Repeat immediately before recording; live inputs can change. Saved captures were not replaced.' };
await writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
for (const entry of results) console.log(`${entry.scenario}: ${entry.reason}; feed age=${entry.feedAgeSeconds ?? 'unknown'}s; headroom=${entry.freshnessHeadroomSeconds ?? 'unknown'}s`);
console.log(`\n${summary.ready ? 'Both scenarios ready at dry-run time.' : 'Not ready to record. Keep saved transcripts as backup and retry after the underlying input recovers.'}\nEvidence: ${path.relative(root, directory)}`);
process.exitCode = summary.ready ? 0 : 1;
