const hre = require('hardhat');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const MOCK_FORWARDER = '0x15fC6ae953E024d975e77382eEeC56A9101f9F88';

async function main() {
  if (process.env.ALLOW_SIMULATION_DEMO !== 'true') throw new Error('Set ALLOW_SIMULATION_DEMO=true to explicitly deploy the testnet-only, identity-unverified demo receiver.');
  if (hre.network.name !== 'sepolia-demo') throw new Error('Use the dedicated sepolia-demo network.');
  if (!process.env.DEMO_PRIVATE_KEY) throw new Error('Set DEMO_PRIVATE_KEY to a dedicated funded Sepolia test wallet.');
  const chain = await hre.ethers.provider.getNetwork();
  if (chain.chainId !== 11155111n) throw new Error('Demo deployment only supports Sepolia.');
  if (await hre.ethers.provider.getCode(MOCK_FORWARDER) === '0x') throw new Error('Official Sepolia mock forwarder not found; recheck the Chainlink directory.');
  const [signer] = await hre.ethers.getSigners();
  const receiver = await (await hre.ethers.getContractFactory('AgentPaySimulationReceiver')).deploy(MOCK_FORWARDER, true);
  await receiver.waitForDeployment();
  const receipt = await receiver.deploymentTransaction().wait();
  const manifest = { simulationOnly: true, skipWorkflowIdentity: true, chainId: 11155111, receiver: await receiver.getAddress(),
    forwarder: MOCK_FORWARDER, deployer: signer.address, deploymentTransaction: receipt.hash,
    explorerUrl: `https://sepolia.etherscan.io/address/${await receiver.getAddress()}` };
  const file = path.resolve('.local/cre/demo-deployment.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
  console.log('DEMO ONLY: no workflow identity authentication and no payment-settlement API. Strict AgentPayGuard is unchanged.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
