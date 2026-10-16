const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Check if we need to deploy Mock USD (for testnets or local)
  // For mainnet, we would use the real tUSD address
  let tokenAddress;

  // You might want to hardcode the address if you already have one on the network
  // const EXISTING_PAYMENT_TOKEN_ADDRESS = "0x..."; 

  if (hre.network.name === "sepolia" || hre.network.name === "hardhat" || hre.network.name === "localhost") {
    console.log("Deploying MockUSD...");
    const MockUSD = await hre.ethers.getContractFactory("MockUSD");
    const mockUSD = await MockUSD.deploy();
    await mockUSD.waitForDeployment();
    tokenAddress = await mockUSD.getAddress();
    console.log("MockUSD deployed to:", tokenAddress);
  } else {
    // Setup for other networks or throw error if address not provided
    throw new Error("tUSD token address required for this network");
  }

  console.log("Deploying AgentPayStream with tUSD address:", tokenAddress);
  const AgentPayStream = await hre.ethers.getContractFactory("AgentPayStream");
  const agentPayStream = await AgentPayStream.deploy(tokenAddress);

  await agentPayStream.waitForDeployment();

  console.log("AgentPayStream deployed to:", await agentPayStream.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });