import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  chmodSync,
} from 'node:fs';
import cli from '../lib/cli.cjs';
import { validateResult } from '../lib/cre-validation.mjs';

const env = {
  ...process.env,
  CRE_BIN: '/definitely-missing-cre',
  PRIVATE_KEY_1: '',
  PRIVATE_KEY: '',
  DEMO_PRIVATE_KEY: '',
  ALLOW_SIMULATION_DEMO: 'false',
  GEMINI_API_KEY: '',
};
export function invoke(command, args = [], extra = {}) {
  return spawnSync(
    process.execPath,
    command.startsWith('demo/')
      ? ['-r', 'ts-node/register', command, ...args]
      : [command, ...args],
    {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...env, TS_NODE_PROJECT: 'demo/tsconfig.json', ...extra },
    }
  );
}
const commands = {
  'cre:simulate': 'scripts/simulate-cre.mjs',
  'cre:dry-run': 'scripts/preflight-cre.mjs',
  'cre:simulate:write': 'scripts/simulate-cre-write.mjs',
  'demo:check': 'demo/check-setup.ts',
  'demo:consumer': 'demo/consumer.ts',
  'demo:provider': 'demo/provider.ts',
};
const snapshots = JSON.parse(
  readFileSync(new URL('./snapshots/cli.json', import.meta.url))
);
test('help and JSON help match the public contract without credentials, spawning CRE or starting a listener', () => {
  for (const [name, file] of Object.entries(commands)) {
    const help = invoke(file, ['--help']);
    assert.equal(help.status, 0, help.stderr);
    assert.equal(help.stdout, snapshots.help[name]);
    const json = invoke(file, ['--help', '--json']);
    assert.equal(json.status, 0, json.stderr);
    assert.deepEqual(JSON.parse(json.stdout), {
      schemaVersion: 1,
      ok: true,
      command: name,
      data: { help: help.stdout.trimEnd() },
    });
  }
});
test('unknown, positional, duplicate and missing-value flags fail before operation', () => {
  for (const argv of [
    ['--captur'],
    ['pay'],
    ['--capture=false'],
    ['--json', '--json'],
  ])
    assert.throws(() => cli.parseFlags(argv, { capture: 'boolean' }), {
      code: 'USAGE',
      exitCode: 2,
    });
  assert.throws(
    () =>
      cli.parseFlags(['--recording-window'], { 'recording-window': 'value' }),
    { code: 'USAGE' }
  );
  assert.deepEqual(
    cli.parseFlags(['--recording-window', '900'], {
      'recording-window': 'value',
    }),
    { 'recording-window': '900' }
  );
  for (const file of Object.values(commands)) {
    const run = invoke(file, ['--unknown', '--json']);
    assert.equal(run.status, 2, run.stderr);
    assert.equal(JSON.parse(run.stdout).error.code, 'USAGE');
  }
});
test('missing keys and demo opt-in produce stable one-object JSON failures with nonzero exit codes', () => {
  for (const [name, file] of Object.entries(commands).filter(([name]) =>
    ['demo:check', 'demo:consumer', 'cre:simulate:write'].includes(name)
  )) {
    const run = invoke(file, ['--json']);
    assert.equal(run.status, 2, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), snapshots.errors[name]);
  }
  const key = 'invalid-sensitive-test-key';
  const run = invoke('demo/check-setup.ts', ['--json'], { PRIVATE_KEY_1: key });
  assert.equal(run.status, 2);
  assert.equal((run.stdout + run.stderr).includes(key), false);
});
test('recording-window bounds reject malformed values without executing CRE', () => {
  for (const window of ['0', '-1', '1.5', '1e3', '3601', '']) {
    const run = invoke('scripts/preflight-cre.mjs', [
      `--recording-window=${window}`,
      '--json',
    ]);
    assert.equal(run.status, 2);
    assert.equal(JSON.parse(run.stdout).error.code, 'USAGE');
  }
});
test('missing CRE executable fails as a dependency error rather than a successful result', () => {
  const run = invoke('scripts/simulate-cre.mjs', ['--json']);
  assert.equal(run.status, 1, run.stderr);
  assert.equal(JSON.parse(run.stdout).error.code, 'DEPENDENCY');
});
test('subprocess timeout is bounded and rejected even when a child ignores SIGTERM', async () => {
  await assert.rejects(
    cli.runChild(
      process.execPath,
      ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],
      { timeoutMs: 150, quiet: true }
    ),
    { code: 'TIMEOUT' }
  );
});
test('result validation binds full intent, policy, scale and encoded report before evidence can be saved', () => {
  const config = JSON.parse(
    readFileSync(
      new URL('../../cre/payment-guard/config.staging.json', import.meta.url)
    )
  );
  const base = JSON.parse(
    readFileSync(new URL('../../docs/evidence/cre-allow.json', import.meta.url))
  ).result;
  validateResult(base, config);
  for (const change of [
    { tokenDecimals: 18 },
    { receiverAddress: config.request.agent },
    { validUntil: base.validUntil + 1 },
    { encodedReport: '0x' },
    { maxDeviationBps: 999 },
    { request: { ...base.request, agent: config.request.recipient } },
  ]) {
    assert.throws(() => validateResult({ ...base, ...change }, config), {
      code: 'RESULT_MISMATCH',
    });
  }
});
test('JSON success and child failure are one object; mismatched results cannot replace captures', () => {
  const fixture = new URL('./fixtures/cre-process.mjs', import.meta.url)
    .pathname;
  chmodSync(fixture, 0o755);
  const protectedFiles = [
    '.local/cre/allow.json',
    '.local/cre/allow.config.json',
    'docs/evidence/cre-allow.json',
    'docs/evidence/cre-allow.log',
    'vite-project/public/evidence/cre-allow.json',
  ];
  const originals = protectedFiles.map((file) =>
    existsSync(file) ? readFileSync(file) : null
  );
  try {
    const success = invoke('scripts/simulate-cre.mjs', ['--json'], {
      CRE_BIN: fixture,
      CRE_ETH_PRIVATE_KEY: 'unneeded-test-signing-key',
    });
    assert.equal(success.status, 0, success.stderr);
    const envelope = JSON.parse(success.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.result.request.amount, '10000');
    assert.equal(envelope.data.result.tokenDecimals, 6);
    assert.equal(envelope.data.result.published, false);
    const normalize = {
      ...envelope,
      data: {
        ...envelope.data,
        capturedAt: '<timestamp>',
        logSha256: '<sha256>',
        configSha256: '<sha256>',
      },
    };
    assert.deepEqual(normalize, snapshots.creSuccess);
    for (const [mode, code] of [
      ['fail', 'SIMULATION_FAILED'],
      ['corrupt', 'RESULT_MISMATCH'],
      ['stale', 'RESULT_MISMATCH'],
    ]) {
      const failure = invoke(
        'scripts/simulate-cre.mjs',
        ['--capture', '--json'],
        { CRE_BIN: fixture, CLI_FIXTURE: mode }
      );
      assert.equal(failure.status, 1, failure.stderr);
      assert.equal(JSON.parse(failure.stdout).error.code, code);
      for (const [index, file] of protectedFiles.entries())
        if (file.startsWith('docs/') || file.startsWith('vite-project/'))
          assert.deepEqual(readFileSync(file), originals[index]);
    }
  } finally {
    for (const [index, file] of protectedFiles.entries()) {
      if (originals[index] !== null) writeFileSync(file, originals[index]);
      else if (existsSync(file)) unlinkSync(file);
    }
  }
});
