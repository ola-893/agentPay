import cli from './lib/cli.cjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSimulationResult,
  recordingReadiness,
  stripAnsi,
} from './lib/cre-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await cli.cliMain(
  'cre:dry-run',
  { 'save-evidence': 'boolean', 'recording-window': 'value' },
  `Usage: npm run --silent cre:dry-run -- [--recording-window SECONDS] [--save-evidence] [--json]
Run ALLOW and budget DENY previews sequentially; no broadcast or replacement of captures.
--recording-window SECONDS  Required freshness headroom, integer 1..3600 (default 600).
                           --recording-window=SECONDS is also accepted.
--save-evidence             Save a new directory under docs/evidence/preflight (default .local/cre/preflight).
--json                      One readiness envelope on stdout; progress on stderr.
--help                      Show help without running CRE.
Exit: 0 both expected outcomes with headroom; 1 not ready/execution failure; 2 usage error; 130/143 interrupted.`,
  async ({ flags }) => {
    const rawWindow = flags['recording-window'] ?? '600';
    const recordingWindowSeconds = Number(rawWindow);
    if (
      !/^[0-9]+$/.test(rawWindow) ||
      !Number.isSafeInteger(recordingWindowSeconds) ||
      recordingWindowSeconds <= 0 ||
      recordingWindowSeconds > 3600
    )
      throw new cli.CliError(
        'USAGE',
        'Recording window must be an integer from 1 to 3600 seconds.',
        2
      );
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const directory = path.join(
      root,
      flags['save-evidence']
        ? 'docs/evidence/preflight'
        : '.local/cre/preflight',
      stamp
    );
    await mkdir(directory, { recursive: true });
    const results = [];
    for (const scenario of ['allow', 'deny-budget']) {
      const args = [
        'run',
        'cre:simulate',
        ...(scenario === 'deny-budget' ? ['--', '--deny-budget'] : []),
      ];
      console.log(`\n$ npm ${args.join(' ')}\n`);
      let output = '',
        code = 1,
        failure;
      try {
        const run = await cli.runChild(
          process.env.npm_execpath ? process.execPath : 'npm',
          process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args,
          { cwd: root, timeoutMs: 200000, label: scenario }
        );
        output = run.output;
        code = run.code;
      } catch (error) {
        if (error.code === 'INTERRUPTED') throw error;
        failure = error.message;
      }
      const entry = {
        scenario,
        command: `npm ${args.join(' ')}`,
        exitCode: code,
      };
      try {
        if (failure) throw new Error(failure);
        const result = parseSimulationResult(output);
        Object.assign(
          entry,
          recordingReadiness(result, scenario, recordingWindowSeconds),
          { result }
        );
        entry.ready = entry.ready && code === 0;
      } catch (error) {
        Object.assign(entry, { ready: false, reason: error.message });
      }
      await writeFile(
        path.join(directory, `${scenario}.log`),
        stripAnsi(output).split(root).join('<repo>')
      );
      results.push(entry);
    }
    const summary = {
      checkedAt: new Date().toISOString(),
      recordingWindowSeconds,
      ready: results.every((r) => r.ready),
      results,
      note: 'Readiness describes this dry run only. Repeat immediately before recording; live inputs can change. Saved captures were not replaced.',
    };
    await writeFile(
      path.join(directory, 'summary.json'),
      JSON.stringify(summary, null, 2) + '\n'
    );
    for (const entry of results)
      console.log(
        `${entry.scenario}: ${entry.reason}; feed age=${
          entry.feedAgeSeconds ?? 'unknown'
        }s; headroom=${entry.freshnessHeadroomSeconds ?? 'unknown'}s`
      );
    console.log(
      `\n${
        summary.ready
          ? 'Both scenarios ready at dry-run time.'
          : 'Not ready to record. Keep saved transcripts as backup and retry after the underlying input recovers.'
      }\nEvidence: ${path.relative(root, directory)}`
    );
    if (!summary.ready) process.exitCode = 1;
    return summary;
  }
);
