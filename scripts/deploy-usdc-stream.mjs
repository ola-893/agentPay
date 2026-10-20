import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import {
  Wallet,
  JsonRpcProvider,
  Contract,
  ContractFactory,
  keccak256,
} from "ethers";
import cli from "./lib/cli.cjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
await cli.cliMain(
  "deploy:usdc-stream",
  {},
  `Usage: npm run --silent deploy:usdc-stream -- [--json] [--help]
Deploy AgentPayStream configured for Circle USDC on Ethereum Sepolia.
Requires compiled artifacts, PRIVATE_KEY_1 or PRIVATE_KEY and Sepolia ETH.
Writes verified public deployment evidence to docs/deployment/usdc-stream.json.
Does not deploy a token, guard or CRE workflow. Exit: 0 verified; 1 failed; 2 config.`,
  async () => {
    dotenv.config({ path: path.join(root, ".env"), quiet: true });
    const provider = new JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com"
    );
    try {
      if ((await provider.getNetwork()).chainId !== 11155111n)
        throw new cli.CliError("WRONG_NETWORK", "Use Ethereum Sepolia.");
      let wallet;
      try {
        wallet = new Wallet(
          process.env.PRIVATE_KEY_1 || process.env.PRIVATE_KEY || "",
          provider
        );
      } catch {
        throw new cli.CliError(
          "CONFIG",
          "Set a dedicated funded Sepolia wallet key.",
          2
        );
      }
      const token = new Contract(
        USDC,
        ["function decimals() view returns(uint8)"],
        provider
      );
      if (
        (await provider.getCode(USDC)) === "0x" ||
        (await token.decimals()) !== 6n
      )
        throw new cli.CliError(
          "TOKEN",
          "Expected Circle Sepolia USDC with six decimals."
        );
      const artifact = JSON.parse(
        await readFile(
          path.join(
            root,
            "artifacts/contracts/AgentPayStream.sol/AgentPayStream.json"
          ),
          "utf8"
        )
      );
      const factory = new ContractFactory(
        artifact.abi,
        artifact.bytecode,
        wallet
      );
      const deployment = await factory.getDeployTransaction(USDC);
      const estimate = await provider.estimateGas({
        ...deployment,
        from: wallet.address,
      });
      const fees = await provider.getFeeData();
      if (
        (await provider.getBalance(wallet.address)) <
        estimate * (fees.maxFeePerGas || fees.gasPrice || 0n)
      )
        throw new cli.CliError(
          "BALANCE",
          "Insufficient Sepolia ETH for estimated deployment gas."
        );
      const contract = await factory.deploy(USDC);
      console.log(
        `Deployment submitted: ${contract.deploymentTransaction().hash}`
      );
      const receipt = await contract.deploymentTransaction().wait(2, 180000);
      if (!receipt || receipt.status !== 1)
        throw new cli.CliError(
          "DEPLOYMENT_FAILED",
          "Stream deployment was not confirmed."
        );
      const address = await contract.getAddress(),
        code = await provider.getCode(address);
      if (
        code.toLowerCase() !== artifact.deployedBytecode.toLowerCase() ||
        (await contract.paymentToken()).toLowerCase() !== USDC.toLowerCase()
      )
        throw new cli.CliError(
          "VERIFICATION_FAILED",
          "Deployed runtime or token binding mismatch."
        );
      const result = {
        schemaVersion: 1,
        chainId: 11155111,
        address,
        token: USDC,
        tokenDecimals: 6,
        deployer: wallet.address,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
        confirmations: await receipt.confirmations(),
        runtimeCodeHash: keccak256(code),
        matchesCompiledRuntime: true,
        verifiedAt: new Date().toISOString(),
        creWorkflowDeployed: false,
      };
      await writeFile(
        path.join(root, "docs/deployment/usdc-stream.json"),
        JSON.stringify(result, null, 2) + "\n"
      );
      console.log(`Verified USDC stream: ${address}`);
      return result;
    } finally {
      provider.destroy();
    }
  }
);
