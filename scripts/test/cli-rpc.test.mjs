import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  parseEther,
  AbiCoder,
  id,
  solidityPacked,
} from 'ethers';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
// Public Hardhat fixture key ONLY. Never a user-funded wallet; local RPC below.
const fixtureKey =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
let auditIndex = 0;
async function record(command, result) {
  const directory = path.join(root, '.local/cli-audit/rpc');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${++auditIndex}.json`),
    JSON.stringify(
      {
        localFixturesOnly: true,
        note: 'Disposable Hardhat RPC with test chain ID; no public Sepolia deployment or payment.',
        command,
        ...result,
      },
      null,
      2
    ) + '\n'
  );
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function invoke(command, args = [], env = {}) {
  const child = spawn(
    process.execPath,
    command.startsWith('demo/')
      ? ['-r', 'ts-node/register', command, ...args]
      : [command, ...args],
    {
      cwd: root,
      env: {
        ...process.env,
        TS_NODE_PROJECT: 'demo/tsconfig.json',
        GEMINI_API_KEY: '',
        PRIVATE_KEY_1: fixtureKey,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const timeout = setTimeout(() => child.kill('SIGKILL'), 20000);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  clearTimeout(timeout);
  await record(`${command} ${args.join(' ')}`, { code, stdout, stderr });
  return { code, stdout, stderr };
}
async function deployment(script, network, env) {
  const args = [
    'node_modules/hardhat/internal/cli/cli.js',
    'run',
    '--no-compile',
    `scripts/${script}.js`,
    '--network',
    network,
  ];
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  clearTimeout(timer);
  await record(args.join(' '), { code, stdout, stderr });
  return { code, stdout, stderr };
}
async function chain(chainId) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agentpay-cli-rpc-'));
  const file = path.join(directory, 'hardhat.cjs');
  await writeFile(
    file,
    `const base=require(${JSON.stringify(
      path.join(root, 'hardhat.config.js')
    )}); module.exports={...base,paths:{root:${JSON.stringify(
      root
    )}},networks:{...base.networks,hardhat:{chainId:${chainId},allowBlocksWithSameTimestamp:true}}};`
  );
  const port = await freePort(),
    url = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [
      'node_modules/hardhat/internal/cli/cli.js',
      'node',
      '--config',
      file,
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    { cwd: root, stdio: 'ignore' }
  );
  for (let attempts = 0; ; attempts++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        }),
      });
      assert.equal(parseInt((await response.json()).result, 16), chainId);
      break;
    } catch (error) {
      if (attempts > 100 || server.exitCode !== null) {
        server.kill();
        throw new Error(`Local fixture could not start: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  const provider = new JsonRpcProvider(url, undefined, { batchMaxCount: 1 });
  return {
    provider,
    url,
    close: async () => {
      provider.destroy();
      server.kill();
      await new Promise((resolve) => server.once('close', resolve));
      await rm(directory, { recursive: true, force: true });
    },
  };
}
async function deploy(name, signer, ...args) {
  const file = ['SixDecimalToken', 'MockCREForwarder'].includes(name)
    ? `contracts/test/${name}.sol/${name}.json`
    : `contracts/${name}.sol/${name}.json`;
  const artifact = JSON.parse(
    await readFile(path.join(root, 'artifacts', file))
  );
  const contract = await new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    signer
  ).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}
async function startLegacyProvider(env) {
  const child = spawn(
    process.execPath,
    ['-r', 'ts-node/register', 'demo/provider.ts', '--json'],
    {
      cwd: root,
      env: { ...process.env, TS_NODE_PROJECT: 'demo/tsconfig.json', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let stdout = '',
    stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Provider did not become ready: ' + stderr));
    }, 12000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes('\n')) {
        try {
          assert.equal(JSON.parse(stdout).ok, true);
          clearTimeout(timer);
          resolve();
        } catch (error) {
          clearTimeout(timer);
          child.kill();
          reject(error);
        }
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Provider exited ${code}: ${stdout} ${stderr}`));
    });
  });
  await record('demo/provider.ts --json (startup)', { stdout, stderr });
  return async () => {
    child.kill();
    await new Promise((resolve) => child.once('close', resolve));
  };
}
test(
  'legacy CLI validates a real local deployment, rejects wrong chain/units/binding/gas, and emits stable JSON',
  { timeout: 90000 },
  async () => {
    const local = await chain(11155111);
    try {
      const signer = await local.provider.getSigner(0),
        recipient = await (await local.provider.getSigner(1)).getAddress();
      const token = await deploy('MockUSD', signer),
        other = await deploy('MockUSD', signer),
        six = await deploy('SixDecimalToken', signer);
      const stream = await deploy(
        'AgentPayStream',
        signer,
        await token.getAddress()
      );
      const env = {
        SEPOLIA_RPC_URL: local.url,
        AGENTPAY_STREAM_ADDRESS: await stream.getAddress(),
        PAYMENT_TOKEN_ADDRESS: await token.getAddress(),
        PAYMENT_RECIPIENT_ADDRESS: recipient,
      };
      const forwarder = await deploy('MockCREForwarder', signer);
      const deployEnv = {
        ...env,
        PRIVATE_KEY: fixtureKey,
        DEMO_PRIVATE_KEY: fixtureKey,
        CRE_FORWARDER_ADDRESS: await forwarder.getAddress(),
        CRE_WORKFLOW_ID: '',
      };
      const legacyDeploy = await deployment('deploy', 'sepolia', deployEnv);
      assert.equal(legacyDeploy.code, 0, legacyDeploy.stderr);
      const guardDeploy = await deployment(
        'deploy-guard',
        'sepolia',
        deployEnv
      );
      assert.equal(guardDeploy.code, 0, guardDeploy.stderr);
      assert.match(guardDeploy.stdout, /"reportingEnabled": false/);
      const invalidId = await deployment('deploy-guard', 'sepolia', {
        ...deployEnv,
        CRE_WORKFLOW_ID: 'bad-id',
      });
      assert.equal(invalidId.code, 1);
      assert.match(invalidId.stderr, /32-byte hex/);
      const invalidForwarder = await deployment('deploy-guard', 'sepolia', {
        ...deployEnv,
        CRE_FORWARDER_ADDRESS: recipient,
      });
      assert.equal(invalidForwarder.code, 1);
      assert.match(invalidForwarder.stderr, /no deployed bytecode/);
      // Supply mock code only to the local fixture's official-address slot.
      const mockAddress = '0x15fC6ae953E024d975e77382eEeC56A9101f9F88';
      await local.provider.send('hardhat_setCode', [
        mockAddress,
        await local.provider.getCode(await forwarder.getAddress()),
      ]);
      const manifestFile = path.join(root, '.local/cre/demo-deployment.json');
      let oldManifest;
      try {
        oldManifest = await readFile(manifestFile);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      try {
        const demoDeploy = await deployment('deploy-cre-demo', 'sepolia-demo', {
          ...deployEnv,
          ALLOW_SIMULATION_DEMO: 'true',
        });
        assert.equal(demoDeploy.code, 0, demoDeploy.stderr);
        const manifest = JSON.parse(await readFile(manifestFile));
        assert.equal(manifest.simulationOnly, true);
        assert.equal(manifest.skipWorkflowIdentity, true);
        const noKey = await invoke(
          'scripts/simulate-cre-write.mjs',
          ['--broadcast', '--json'],
          { ...env, ALLOW_SIMULATION_DEMO: 'true', DEMO_PRIVATE_KEY: '' }
        );
        assert.equal(noKey.code, 2);
        assert.equal(JSON.parse(noKey.stdout).error.code, 'CONFIG');
        const files = [
          'write.config.json',
          'write-simulation.json',
          'write-simulation.log',
        ].map((file) => path.join(root, '.local/cre', file));
        const backups = await Promise.all(
          files.map((file) =>
            readFile(file).catch((error) => {
              if (error.code === 'ENOENT') return null;
              throw error;
            })
          )
        );
        try {
          const simulation = await invoke(
            'scripts/simulate-cre-write.mjs',
            ['--json'],
            {
              ...env,
              ALLOW_SIMULATION_DEMO: 'true',
              CRE_BIN: path.join(root, 'scripts/test/fixtures/cre-process.mjs'),
              CRE_ETH_PRIVATE_KEY: 'unused-test-key',
            }
          );
          assert.equal(
            simulation.code,
            0,
            simulation.stdout + simulation.stderr
          );
          const output = JSON.parse(simulation.stdout);
          assert.equal(output.data.broadcastRequested, false);
          assert.equal(output.data.publication, null);
          assert.equal(output.data.result.published, false);
        } finally {
          for (const [i, file] of files.entries()) {
            if (backups[i]) await writeFile(file, backups[i]);
            else await rm(file, { force: true });
          }
        }
      } finally {
        if (oldManifest) await writeFile(manifestFile, oldManifest);
        else await rm(manifestFile, { force: true });
      }
      const run = await invoke('demo/check-setup.ts', ['--json'], env);
      assert.equal(run.code, 0, run.stderr);
      const result = JSON.parse(run.stdout);
      assert.equal(result.ok, true);
      assert.equal(result.data.tokenDecimals, 18);
      assert.equal(
        result.data.tokenBalanceRaw,
        parseEther('1000000').toString()
      );
      assert.equal(result.data.readOnly, true);
      const consumer = Wallet.createRandom();
      await local.provider.send('hardhat_setBalance', [
        consumer.address,
        '0x56BC75E2D63100000',
      ]);
      const stopProvider = await startLegacyProvider(env);
      try {
        const conflict = await invoke('demo/provider.ts', ['--json'], env);
        assert.equal(conflict.code, 1);
        assert.equal(JSON.parse(conflict.stdout).ok, false);
        const success = await invoke('demo/consumer.ts', ['--json'], {
          ...env,
          PRIVATE_KEY_1: consumer.privateKey,
        });
        assert.equal(success.code, 0, success.stdout + success.stderr);
        const paid = JSON.parse(success.stdout);
        assert.equal(paid.ok, true);
        assert.equal(paid.data.metrics.requestsSent, 4);
        assert.equal(paid.data.metrics.signersTriggered, 1);
        assert.equal(
          paid.data.tokenBalanceRaw,
          (parseEther('100') - parseEther('0.36')).toString()
        );
        assert.equal(
          await token.allowance(consumer.address, await stream.getAddress()),
          0n
        );
      } finally {
        await stopProvider();
      }
      for (const [changes, expected] of [
        [{ PAYMENT_TOKEN_ADDRESS: await signer.getAddress() }, 'DEPLOYMENT'],
        [{ PAYMENT_TOKEN_ADDRESS: await six.getAddress() }, 'TOKEN_UNITS'],
        [{ PAYMENT_TOKEN_ADDRESS: await other.getAddress() }, 'TOKEN_BINDING'],
        [{ SEPOLIA_RPC_URL: 'not-a-url' }, 'CONFIG'],
        [{ PRIVATE_KEY_1: 'bad-key' }, 'CONFIG'],
      ]) {
        const failure = await invoke('demo/check-setup.ts', ['--json'], {
          ...env,
          ...changes,
        });
        assert.notEqual(failure.code, 0, failure.stdout + failure.stderr);
        assert.equal(JSON.parse(failure.stdout).error.code, expected);
      }
      const address = await signer.getAddress();
      await local.provider.send('hardhat_setBalance', [address, '0x0']);
      const gas = await invoke('demo/check-setup.ts', ['--json'], env);
      assert.equal(gas.code, 1);
      assert.match(JSON.parse(gas.stdout).error.message, /no Sepolia ETH/);
      await local.provider.send('hardhat_setBalance', [
        address,
        '0x56BC75E2D63100000',
      ]);
      const noProvider = await invoke('demo/consumer.ts', ['--json'], env);
      assert.equal(noProvider.code, 1, noProvider.stderr);
      assert.equal(JSON.parse(noProvider.stdout).ok, false);
      const wrong = await chain(31337);
      try {
        const failure = await invoke('demo/check-setup.ts', ['--json'], {
          ...env,
          SEPOLIA_RPC_URL: wrong.url,
        });
        assert.equal(failure.code, 1);
        assert.equal(JSON.parse(failure.stdout).error.code, 'WRONG_NETWORK');
      } finally {
        await wrong.close();
      }
    } finally {
      await local.close();
    }
  }
);

test(
  'guarded SDK settles through real local contracts and preserves authority on insufficient allowance/balance',
  { timeout: 30000 },
  async () => {
    const local = await chain(11155111);
    const sdkEthers = require('../../sdk/node_modules/ethers');
    const { GuardedPaymentClient, AgentPaySDK } = require('../../sdk/dist');
    const provider = new sdkEthers.JsonRpcProvider(local.url);
    try {
      const owner = await local.provider.getSigner(0),
        forwarder = await local.provider.getSigner(1),
        recipient = await (await local.provider.getSigner(2)).getAddress();
      const agent = new sdkEthers.Wallet(fixtureKey, provider);
      const token = await deploy('SixDecimalToken', owner);
      const workflow = id('local-cli-audit'),
        request = id('local-payment');
      const guard = await deploy(
        'AgentPayGuard',
        owner,
        await forwarder.getAddress(),
        workflow
      );
      const settlement = await deploy(
        'AgentPaySettlement',
        owner,
        await guard.getAddress()
      );
      await (await guard.setSettlement(await settlement.getAddress())).wait();
      const block = await local.provider.getBlock('latest');
      const report = AbiCoder.defaultAbiCoder().encode(
        [
          'uint256',
          'address',
          'bytes32',
          'address',
          'address',
          'address',
          'uint256',
          'uint64',
          'bool',
        ],
        [
          11155111,
          await guard.getAddress(),
          request,
          agent.address,
          recipient,
          await token.getAddress(),
          10000n,
          block.timestamp + 300,
          true,
        ]
      );
      await (
        await guard
          .connect(forwarder)
          .onReport(
            solidityPacked(
              ['bytes32', 'bytes10', 'address'],
              [workflow, '0x00000000000000000000', await owner.getAddress()]
            ),
            report
          )
      ).wait();
      const args = [request, recipient, await token.getAddress(), 10000n];
      await (await token.approve(await settlement.getAddress(), 10000n)).wait();
      await assert.rejects(settlement.settle(...args), /Token transfer failed/);
      assert.equal(await guard.consumed(request), false);
      await (await token.approve(await settlement.getAddress(), 0n)).wait();
      await (await token.mint(agent.address, 10000n)).wait();
      await assert.rejects(settlement.settle(...args), /Token transfer failed/);
      assert.equal(await guard.consumed(request), false);
      const client = new GuardedPaymentClient(agent, {
        guardAddress: await guard.getAddress(),
        settlementAddress: await settlement.getAddress(),
        chainId: 11155111,
      });
      const receipt = await client.pay(...args);
      await record('GuardedPaymentClient.pay (SDK, no payment CLI exists)', {
        status: receipt.status,
        hash: receipt.hash,
        requestId: request,
        amountRaw: '10000',
      });
      assert.equal(receipt.status, 1);
      assert.equal(await token.balanceOf(recipient), 10000n);
      await assert.rejects(client.pay(...args), /authorization missing/);
      const legacy = new AgentPaySDK({
        privateKey: fixtureKey,
        rpcUrl: local.url,
      });
      const stream = await deploy(
        'AgentPayStream',
        owner,
        await token.getAddress()
      );
      await assert.rejects(
        legacy.createStream(
          await stream.getAddress(),
          await token.getAddress(),
          10000n,
          10,
          {},
          recipient
        ),
        /18-decimal/
      );
      assert.equal(
        await token.allowance(agent.address, await stream.getAddress()),
        0n
      );
    } finally {
      provider.destroy();
      await local.close();
    }
  }
);
