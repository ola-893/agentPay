const hre = require('hardhat');

async function main() {
  const forwarder = process.env.CRE_FORWARDER_ADDRESS;
  if (!forwarder || !hre.ethers.isAddress(forwarder) || forwarder === hre.ethers.ZeroAddress) throw new Error('Set CRE_FORWARDER_ADDRESS from the official Chainlink directory for this network.');
  const workflowId = process.env.CRE_WORKFLOW_ID || hre.ethers.ZeroHash;
  const guard = await (await hre.ethers.getContractFactory('AgentPayGuard')).deploy(forwarder, workflowId);
  await guard.waitForDeployment();
  const settlement = await (await hre.ethers.getContractFactory('AgentPaySettlement')).deploy(await guard.getAddress());
  await settlement.waitForDeployment();
  await (await guard.setSettlement(await settlement.getAddress())).wait();
  console.log(JSON.stringify({ network: hre.network.name, guard: await guard.getAddress(), settlement: await settlement.getAddress(), workflowId, reportingEnabled: workflowId !== hre.ethers.ZeroHash }, null, 2));
  if (workflowId === hre.ethers.ZeroHash) console.log('Reporting is disabled. After CRE deployment, call guard.setWorkflowId(actualWorkflowId) from the deploying owner.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
