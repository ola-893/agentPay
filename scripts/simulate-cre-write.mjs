import cli from './lib/cli.cjs';
import { validateConfig, validateResult } from './lib/cre-validation.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import {
  Contract,
  FetchRequest,
  JsonRpcProvider,
  Wallet,
  isAddress,
  ZeroAddress,
} from 'ethers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  MOCK_FORWARDER,
  DEMO_ABI,
  verifyDemoReceipt,
} from './lib/cre-demo.mjs';
import { parseSimulationResult, stripAnsi } from './lib/cre-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await cli.cliMain(
  'cre:simulate:write',
  { broadcast: 'boolean', capture: 'boolean' },
  `Usage: npm run --silent cre:simulate:write -- [--broadcast] [--capture] [--json]
Isolated Sepolia mock-forwarder demo; workflow identity is NOT authenticated.
This receiver records reports and cannot authorize or settle payments.
Default: simulate report delivery without broadcasting.
--broadcast  Send a testnet report; requires ALLOW_SIMULATION_DEMO=true and dedicated DEMO_PRIVATE_KEY.
--capture    With --broadcast, save verified receipt evidence under docs/evidence/onchain-demo.
             Without --broadcast, retain local evidence only.
--json       One result envelope on stdout; progress on stderr.
--help       Show help without reading secrets, contacting RPC or sending a transaction.
Requires Bun, CRE, Sepolia RPC and .local/cre/demo-deployment.json from deploy:cre-demo.
Exit: 0 verified simulation/receipt; 1 execution/receipt failure; 2 usage/config error; 130/143 interrupted.`,
  async ({ flags }) => {
    dotenv.config({ path: path.join(root, '.env'), quiet: true });
    const broadcast = flags.broadcast === true;
    if (process.env.ALLOW_SIMULATION_DEMO !== 'true')
      throw new cli.CliError(
        'CONFIG',
        'Explicitly set ALLOW_SIMULATION_DEMO=true for the testnet-only simulation consumer.',
        2
      );
    if (broadcast && !process.env.DEMO_PRIVATE_KEY)
      throw new cli.CliError(
        'CONFIG',
        'Broadcast requires a dedicated funded Sepolia DEMO_PRIVATE_KEY. No transaction was sent.',
        2
      );
    if (broadcast) {
      try {
        new Wallet(process.env.DEMO_PRIVATE_KEY);
      } catch {
        throw new cli.CliError(
          'CONFIG',
          'DEMO_PRIVATE_KEY must be a valid dedicated signing key. No transaction was sent.',
          2
        );
      }
    }
    let manifest;
    try {
      manifest = JSON.parse(
        await readFile(
          path.join(root, '.local/cre/demo-deployment.json'),
          'utf8'
        )
      );
    } catch {
      throw new cli.CliError(
        'CONFIG',
        'Deploy the isolated receiver with npm run deploy:cre-demo first. No transaction was sent.',
        2
      );
    }
    if (
      manifest.simulationOnly !== true ||
      manifest.skipWorkflowIdentity !== true ||
      manifest.chainId !== 11155111 ||
      !isAddress(manifest.receiver) ||
      manifest.receiver === ZeroAddress ||
      !isAddress(manifest.deployer) ||
      manifest.deployer === ZeroAddress ||
      manifest.forwarder?.toLowerCase() !== MOCK_FORWARDER.toLowerCase()
    )
      throw new cli.CliError(
        'CONFIG',
        'Invalid Sepolia demo deployment manifest.',
        2
      );
    const url =
      process.env.SEPOLIA_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com';
    try {
      if (!['http:', 'https:'].includes(new URL(url).protocol))
        throw new Error();
    } catch {
      throw new cli.CliError(
        'CONFIG',
        'SEPOLIA_RPC_URL must be an HTTP(S) URL.',
        2
      );
    }
    const request = new FetchRequest(url);
    request.timeout = 5000;
    const provider = new JsonRpcProvider(request, undefined, {
      batchMaxCount: 1,
    });
    try {
      if ((await provider.getNetwork()).chainId !== 11155111n)
        throw new Error('Demo RPC is not Sepolia');
      if ((await provider.getCode(manifest.receiver)) === '0x')
        throw new Error('Demo receiver has no deployed bytecode');
      const receiver = new Contract(manifest.receiver, DEMO_ABI, provider);
      if (
        !(await receiver.simulationOnly()) ||
        !(await receiver.skipWorkflowIdentity()) ||
        (await receiver.forwarder()).toLowerCase() !==
          MOCK_FORWARDER.toLowerCase()
      )
        throw new Error('Receiver is not the isolated simulation demo');
      if (
        broadcast &&
        new Wallet(process.env.DEMO_PRIVATE_KEY).address.toLowerCase() !==
          manifest.deployer.toLowerCase()
      )
        throw new Error(
          'Use the dedicated demo deployer wallet for this broadcast'
        );
      const config = JSON.parse(
        await readFile(
          path.join(root, 'cre/payment-guard/config.staging.json'),
          'utf8'
        )
      );
      config.request.requestId = '0x' + randomBytes(32).toString('hex');
      config.request.agent = manifest.deployer;
      config.receiverAddress = manifest.receiver;
      config.publishReport = true;
      const directory = path.join(root, '.local/cre');
      await mkdir(directory, { recursive: true });
      const configPath = path.join(directory, 'write.config.json');
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
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
        configPath,
        ...(broadcast ? ['--broadcast'] : []),
      ];
      console.log(
        `DEMO ONLY: ${
          broadcast
            ? 'broadcasting a Sepolia testnet report'
            : 'simulating a write without broadcasting'
        }. Workflow identity is NOT authenticated. No settlement is enabled.`
      );
      await validateConfig(configPath, root);
      const env = { ...process.env };
      // Preview must not accidentally inherit an operator's signing key.
      delete env.CRE_ETH_PRIVATE_KEY;
      if (broadcast) env.CRE_ETH_PRIVATE_KEY = process.env.DEMO_PRIVATE_KEY;
      const { code, output } = await cli.runChild(
        process.env.CRE_BIN || 'cre',
        args,
        {
          cwd: path.join(root, 'cre'),
          env,
          timeoutMs: 200000,
          label: 'CRE write simulation',
        }
      );
      if (code !== 0)
        throw new cli.CliError(
          'SIMULATION_FAILED',
          `CRE write run failed (exit ${code}); no success evidence was recorded`
        );
      const result = parseSimulationResult(output);
      validateResult(result, config, true);
      await validateConfig(configPath, root, result);
      let publication = null;
      if (broadcast) {
        if (!/^0x[0-9a-fA-F]{64}$/.test(result.reportTransactionHash || ''))
          throw new Error('CRE did not return a transaction hash');
        const receipt = await provider.waitForTransaction(
          result.reportTransactionHash,
          1,
          90000
        );
        publication = verifyDemoReceipt(
          receipt,
          manifest.receiver,
          manifest.deployer,
          result
        );
      }
      const log = stripAnsi(output).split(root).join('<repo>');
      const evidence = {
        capturedAt: new Date().toISOString(),
        simulationOnly: true,
        broadcastRequested: broadcast,
        publication,
        result,
        logSha256: createHash('sha256').update(log).digest('hex'),
      };
      const evidenceDir =
        broadcast && flags.capture
          ? path.join(root, 'docs/evidence/onchain-demo')
          : directory;
      await mkdir(evidenceDir, { recursive: true });
      const name = publication?.transactionHash || 'write-simulation';
      await writeFile(
        path.join(evidenceDir, `${name}.json`),
        JSON.stringify(evidence, null, 2) + '\n'
      );
      await writeFile(path.join(evidenceDir, `${name}.log`), log);
      console.log(
        publication
          ? `Verified mock-forwarder receipt: ${publication.explorerUrl}`
          : 'Write simulation succeeded. No public transaction was broadcast or verified.'
      );
      return evidence;
    } finally {
      provider.destroy();
    }
  }
);
