import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import {
  Wallet,
  JsonRpcProvider,
  FetchRequest,
  ContractFactory,
  keccak256,
} from "ethers";
import cli from "./lib/cli.cjs";
const root = fileURLToPath(new URL("../", import.meta.url));
await cli.cliMain(
  "deploy:decision-journal",
  {},
  `Usage: npm run --silent deploy:decision-journal -- [--json] [--help]
Deploy the local-operator audit receipt contract on Ethereum Sepolia.
Requires compiled contracts and PRIVATE_KEY_1 or PRIVATE_KEY with test ETH.
No USDC transfer, strict guard changes or CRE network deployment.`,
  async () => {
    dotenv.config({ path: path.join(root, ".env"), quiet: true });
    const request = new FetchRequest(
      process.env.SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com"
    );
    request.timeout = 15000;
    const provider = new JsonRpcProvider(request, undefined, {
      batchMaxCount: 1,
    });
    try {
      if ((await provider.getNetwork()).chainId !== 11155111n)
        throw new Error("Sepolia required");
      const wallet = new Wallet(
        process.env.PRIVATE_KEY_1 || process.env.PRIVATE_KEY,
        provider
      );
      const artifact = JSON.parse(
        await readFile(
          path.join(
            root,
            "artifacts/contracts/AgentPayDecisionJournal.sol/AgentPayDecisionJournal.json"
          ),
          "utf8"
        )
      );
      const contract = await new ContractFactory(
        artifact.abi,
        artifact.bytecode,
        wallet
      ).deploy();
      console.log(
        `Journal deployment: ${contract.deploymentTransaction().hash}`
      );
      const receipt = await contract.deploymentTransaction().wait(2, 180000);
      if (!receipt || receipt.status !== 1)
        throw new Error(
          "Deployment not confirmed; inspect transaction before retrying"
        );
      const address = await contract.getAddress(),
        code = await provider.getCode(address);
      if (
        code.toLowerCase() !== artifact.deployedBytecode.toLowerCase() ||
        (await contract.writer()).toLowerCase() !== wallet.address.toLowerCase()
      )
        throw new Error("Deployment verification failed");
      const result = {
        schemaVersion: 1,
        chainId: 11155111,
        address,
        writer: wallet.address,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        runtimeCodeHash: keccak256(code),
        creMode: "local-simulation",
        donAuthenticated: false,
        purpose: "audit-receipts-only",
        verifiedAt: new Date().toISOString(),
      };
      await writeFile(
        path.join(root, "docs/deployment/decision-journal.json"),
        JSON.stringify(result, null, 2) + "\n"
      );
      return result;
    } finally {
      provider.destroy();
    }
  }
);
