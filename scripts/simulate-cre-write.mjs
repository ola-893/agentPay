import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { Contract, JsonRpcProvider, Wallet, isAddress } from 'ethers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { MOCK_FORWARDER, DEMO_ABI, verifyDemoReceipt } from './lib/cre-demo.mjs';
import { parseSimulationResult, stripAnsi } from './lib/cre-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const broadcast = process.argv.includes('--broadcast');
if (process.env.ALLOW_SIMULATION_DEMO !== 'true') throw new Error('Explicitly set ALLOW_SIMULATION_DEMO=true for the testnet-only simulation consumer.');
if (broadcast && !process.env.DEMO_PRIVATE_KEY) throw new Error('Broadcast requires a dedicated funded Sepolia DEMO_PRIVATE_KEY. No transaction was sent.');
let manifest;
try { manifest = JSON.parse(await readFile(path.join(root, '.local/cre/demo-deployment.json'), 'utf8')); }
catch { throw new Error('Deploy the isolated receiver with npm run deploy:cre-demo first. No transaction was sent.'); }
if (!manifest.simulationOnly || !manifest.skipWorkflowIdentity || manifest.chainId !== 11155111 || !isAddress(manifest.receiver)
    || !isAddress(manifest.deployer) || manifest.forwarder?.toLowerCase() !== MOCK_FORWARDER.toLowerCase()) throw new Error('Invalid Sepolia demo deployment manifest');
const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com');
try {
  if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Demo RPC is not Sepolia');
  const receiver = new Contract(manifest.receiver, DEMO_ABI, provider);
  if (!await receiver.simulationOnly() || !await receiver.skipWorkflowIdentity() || (await receiver.forwarder()).toLowerCase() !== MOCK_FORWARDER.toLowerCase()) throw new Error('Receiver is not the isolated simulation demo');
  if (broadcast && new Wallet(process.env.DEMO_PRIVATE_KEY).address.toLowerCase() !== manifest.deployer.toLowerCase()) throw new Error('Use the dedicated demo deployer wallet for this broadcast');
  const config = JSON.parse(await readFile(path.join(root, 'cre/payment-guard/config.staging.json'), 'utf8'));
  config.request.requestId = '0x' + randomBytes(32).toString('hex');
  config.request.agent = manifest.deployer;
  config.receiverAddress = manifest.receiver;
  config.publishReport = true;
  const directory = path.join(root, '.local/cre');
  await mkdir(directory, { recursive: true });
  const configPath = path.join(directory, 'write.config.json');
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  const args = ['workflow', 'simulate', 'payment-guard', '--target', 'staging-settings', '--trigger-index', '0', '--non-interactive', '--config', configPath, ...(broadcast ? ['--broadcast'] : [])];
  console.log(`DEMO ONLY: ${broadcast ? 'broadcasting a Sepolia testnet report' : 'simulating a write without broadcasting'}. Workflow identity is NOT authenticated. No settlement is enabled.`);
  const child = spawn(process.env.CRE_BIN || 'cre', args, { cwd: path.join(root, 'cre'), env: {
    ...process.env, ...(broadcast ? { CRE_ETH_PRIVATE_KEY: process.env.DEMO_PRIVATE_KEY } : {}),
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
  const timeout = setTimeout(() => child.kill('SIGTERM'), 200000);
  let code;
  try { code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }); }
  finally { clearTimeout(timeout); }
  if (code !== 0) throw new Error(`CRE write run failed (exit ${code}); no success evidence was recorded`);
  const result = parseSimulationResult(output);
  if (!result.reportWriteSucceeded || result.receiverAddress.toLowerCase() !== manifest.receiver.toLowerCase()
    || result.request.requestId !== config.request.requestId) throw new Error('No successful matching report write');
  let publication = null;
  if (broadcast) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(result.reportTransactionHash || '')) throw new Error('CRE did not return a transaction hash');
    const receipt = await provider.waitForTransaction(result.reportTransactionHash, 1, 90000);
    publication = verifyDemoReceipt(receipt, manifest.receiver, manifest.deployer, result);
  }
  const log = stripAnsi(output).split(root).join('<repo>');
  const evidence = { capturedAt: new Date().toISOString(), simulationOnly: true, broadcastRequested: broadcast,
    publication, result, logSha256: createHash('sha256').update(log).digest('hex') };
  const evidenceDir = broadcast && process.argv.includes('--capture') ? path.join(root, 'docs/evidence/onchain-demo') : directory;
  await mkdir(evidenceDir, { recursive: true });
  const name = publication?.transactionHash || 'write-simulation';
  await writeFile(path.join(evidenceDir, `${name}.json`), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(path.join(evidenceDir, `${name}.log`), log);
  console.log(publication ? `Verified mock-forwarder receipt: ${publication.explorerUrl}` : 'Write simulation succeeded. No public transaction was broadcast or verified.');
} finally { provider.destroy(); }
