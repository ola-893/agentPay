const { format } = require('node:util');
const { spawn } = require('node:child_process');
let jsonMode = false;

class CliError extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}
function parseFlags(argv, spec = {}) {
  const allowed = { help: 'boolean', json: 'boolean', ...spec };
  const flags = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const match = /^--([a-z][a-z-]*)(?:=(.*))?$/.exec(arg);
    if (!match || !allowed[match[1]])
      throw new CliError('USAGE', `Unknown argument: ${arg}. Use --help.`, 2);
    const [, name, inline] = match;
    if (Object.hasOwn(flags, name))
      throw new CliError('USAGE', `Duplicate option --${name}.`, 2);
    if (allowed[name] === 'boolean') {
      if (inline !== undefined)
        throw new CliError('USAGE', `--${name} does not take a value.`, 2);
      flags[name] = true;
    } else {
      const value = inline ?? argv[++index];
      if (!value || value.startsWith('--'))
        throw new CliError('USAGE', `--${name} requires a value.`, 2);
      flags[name] = value;
    }
  }
  return flags;
}
function redact(value) {
  let message = String(value);
  for (const [key, secret] of Object.entries(process.env)) {
    if (
      /(?:PRIVATE_KEY(?:_\d+)?|API_KEY|OPEN_AI_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN|RPC_URL)$/.test(
        key
      ) &&
      secret?.length >= 4
    )
      message = message.split(secret).join(`[${key} redacted]`);
  }
  return message;
}
async function cliMain(command, spec, help, action) {
  const args = process.argv.slice(2);
  const eventStream = command === 'demo:agent' && (args.includes('--events=ndjson') || args.some((a,i) => a === '--events' && args[i+1] === 'ndjson'));
  const json = args.includes('--json') && !eventStream;
  jsonMode = json || eventStream;
  // SDK/demo dependencies may log progress too. JSON stdout is exclusively
  // the final envelope; diagnostics and ongoing server logs go to stderr.
  for (const method of ['log', 'info', 'warn', 'error']) {
    const stream =
      json || eventStream || method === 'warn' || method === 'error'
        ? process.stderr
        : process.stdout;
    console[method] = (...args) => stream.write(redact(format(...args)) + '\n');
  }
  const emit = (value) =>
    process.stdout.write(
      JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      ) + '\n'
    );
  try {
    const flags = parseFlags(process.argv.slice(2), spec);
    if (flags.help) {
      if (json) emit({ schemaVersion: 1, ok: true, command, data: { help } });
      else process.stdout.write(help + '\n');
      return;
    }
    const data = await action({
      flags,
      log: (...args) => console.log(...args),
    });
    if (json) emit({ schemaVersion: 1, ok: !process.exitCode, command, data });
  } catch (error) {
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const code = error instanceof CliError ? error.code : 'OPERATION_FAILED';
    const message = redact(
      error?.shortMessage || error?.message || 'Operation failed'
    );
    if (json)
      emit({ schemaVersion: 1, ok: false, command, error: { code, message } });
    else console.error(`${code}: ${message}`);
    process.exitCode = exitCode;
  }
}
function runChild(
  command,
  args,
  {
    cwd,
    env = process.env,
    timeoutMs = 180000,
    quiet = false,
    label = command,
  } = {}
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '',
      timedOut = false,
      receivedSignal,
      killTimer;
    const interrupt = (signal) => {
      receivedSignal = signal;
      child.kill(signal);
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
    };
    const onInt = () => interrupt('SIGINT'),
      onTerm = () => interrupt('SIGTERM');
    process.once('SIGINT', onInt);
    process.once('SIGTERM', onTerm);
    const timer = setTimeout(() => {
      timedOut = true;
      interrupt('SIGTERM');
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      process.removeListener('SIGINT', onInt);
      process.removeListener('SIGTERM', onTerm);
    };
    for (const stream of [child.stdout, child.stderr])
      stream.setEncoding('utf8').on('data', (chunk) => {
        output += chunk;
        if (!quiet)
          (jsonMode ? process.stderr : process.stdout).write(redact(chunk));
      });
    child.once('error', (error) => {
      cleanup();
      reject(
        new CliError(
          'DEPENDENCY',
          `${label} could not start (${error.code}). Check the executable and installation.`
        )
      );
    });
    child.once('close', (code, signal) => {
      cleanup();
      if (timedOut)
        return reject(
          new CliError(
            'TIMEOUT',
            `${label} exceeded ${timeoutMs / 1000} seconds.`
          )
        );
      if (receivedSignal)
        return reject(
          new CliError(
            'INTERRUPTED',
            `${label} interrupted.`,
            receivedSignal === 'SIGINT' ? 130 : 143
          )
        );
      resolve({ code: code ?? 1, signal, output });
    });
  });
}
module.exports = { CliError, parseFlags, cliMain, runChild, redact };
