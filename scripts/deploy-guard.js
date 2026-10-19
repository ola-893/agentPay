const hre = require('hardhat');

async function main() {
  const forwarder = process.env.CRE_FORWARDER_ADDRESS;
  if (!forwarder || !hre.ethers.isAddress(forwarder) || forwarder === hre.ethers.ZeroAddress) throw new Error('Set CRE_FORWARDER_ADDRESS from the official Chainlink directory for this network.');
  const workflowId = process.env.CRE_WORKFLOW_ID || hre.ethers.ZeroHash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(workflowId)) throw new Error('CRE_WORKFLOW_ID must be a 32-byte hex value or blank.');
  if (forwarder.toLowerCase() === '0x15fc6ae953e024d975e77382eeec56a9101f9f88') throw new Error('The mock forwarder cannot authenticate production workflow identity. Use deploy:cre-demo for the isolated demo.');
  if (hre.network.name !== 'sepolia') throw new Error('Use deploy:guard on the configured Sepolia network.');
  if (!process.env.PRIVATE_KEY) throw new Error('Set PRIVATE_KEY to a dedicated funded Sepolia deployment wallet.');
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error('Set PRIVATE_KEY to a dedicated funded Sepolia deployment wallet.');
  if ((await hre.ethers.provider.getNetwork()).chainId !== 11155111n) throw new Error('Guard deployment requires Ethereum Sepolia.');
  if (await hre.ethers.provider.getCode(forwarder) === '0x') throw new Error('CRE_FORWARDER_ADDRESS has no deployed bytecode. No contract was deployed.');
  const guard = await (await hre.ethers.getContractFactory('AgentPayGuard')).deploy(forwarder, workflowId);
  await guard.waitForDeployment();
  const settlement = await (await hre.ethers.getContractFactory('AgentPaySettlement')).deploy(await guard.getAddress());
  await settlement.waitForDeployment();
  await (await guard.setSettlement(await settlement.getAddress())).wait();
  console.log(JSON.stringify({ network: hre.network.name, guard: await guard.getAddress(), settlement: await settlement.getAddress(), workflowId, reportingEnabled: workflowId !== hre.ethers.ZeroHash }, null, 2));
  if (workflowId === hre.ethers.ZeroHash) console.log('Reporting is disabled. After CRE deployment, call guard.setWorkflowId(actualWorkflowId) from the deploying owner.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
