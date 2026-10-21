import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import {
  Wallet,
  JsonRpcProvider,
  FetchRequest,
  Interface,
  ZeroAddress,
} from "ethers";
import cli from "../scripts/lib/cli.cjs";
import { createAuditor } from "./audit/controller.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
await cli.cliMain(
  "demo:spend-review",
  { anchor: "boolean", resume: "boolean" },
  `AgentPay / local CRE spend risk and durable decision receipts
Usage: npm run --silent demo:spend-review -- [--anchor] [--resume] [--json]
Default: dry-run 0.01 USDC, over-cap 0.2 USDC, a reverting call and a risk block;
write every result to durable local content-addressed blobs. No payment signed.
--anchor  Batch pending decisions into a real Sepolia receipt; spends test ETH.
--resume  Reconcile/anchor pending receipts only; requires --anchor. No CRE call.
--json    One stdout result; progress stderr. --help needs no credentials/network.
Uses PRIVATE_KEY_1 or PRIVATE_KEY only for --anchor; public payer otherwise.
AGENTPAY_AUDIT_DIR selects local storage. No USDC transfer or DON deployment.`,
  async ({ flags }) => {
    if (flags.resume && !flags.anchor)
      throw new cli.CliError("USAGE", "--resume requires --anchor", 2);
    dotenv.config({ path: path.join(root, ".env"), quiet: true });
    const request = new FetchRequest(
      process.env.SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com"
    );
    request.timeout = 15000;
    const provider = new JsonRpcProvider(request, undefined, {
      batchMaxCount: 1,
      cacheTimeout: -1,
    });
    let auditor;
    try {
      if ((await provider.getNetwork()).chainId !== 11155111n)
        throw new Error("Sepolia required");
      const wallet = flags.anchor
        ? new Wallet(
            process.env.PRIVATE_KEY_1 || process.env.PRIVATE_KEY,
            provider
          )
        : {
            address:
              process.env.AGENTPAY_AUDIT_PAYER ||
              "0xe26468ae02368a75DBDBea58F367B7313942ad26",
          };
      let deployment;
      try {
        deployment = JSON.parse(
          await readFile(
            path.join(root, "docs/deployment/decision-journal.json"),
            "utf8"
          )
        );
      } catch {}
      const directory =
        process.env.AGENTPAY_AUDIT_DIR ||
        path.join(root, ".local/audit", wallet.address.toLowerCase());
      const streamAddress =
          process.env.AGENTPAY_USDC_STREAM_ADDRESS ||
          "0x5199d1dcaB9496d37677DAD8F53481DCc511d585",
        recipient =
          process.env.AGENTPAY_AGENT_RECIPIENT ||
          "0x9950D8950BF80722860f2B6a9e120893a0fE79f7";
      auditor = await createAuditor({
        provider,
        wallet,
        streamAddress,
        recipients: [recipient],
        directory,
        anchorAddress:
          process.env.AGENTPAY_DECISION_JOURNAL_ADDRESS || deployment?.address,
        anchorEnabled: Boolean(flags.anchor),
      });
      const reviews = [];
      if (!flags.resume) {
        const iface = new Interface([
          "function transfer(address,uint256) returns(bool)",
        ]);
        const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
        for (const [label, to, amount, risk] of [
          ["within-cap", recipient, 10000, 0],
          ["over-cap", recipient, 200000, 0],
          ["reverting-token-call", ZeroAddress, 10000, 0],
          ["quality-risk", recipient, 10000, 80],
        ]) {
          // The zero-recipient call is blocked independently by recipient policy;
          // its real Circle revert is also preserved in the simulation evidence.
          const review = await auditor.reviewTransaction(
            {
              to: usdc,
              data: iface.encodeFunctionData("transfer", [to, amount]),
              value: 0n,
            },
            { qualityRiskScore: risk }
          );
          reviews.push({
            label,
            intentId: review.intent.id,
            blobHash: review.pointer.blobHash,
            ...review.record.decision,
          });
        }
      }
      await auditor.flush();
      const summary = await auditor.summary();
      console.log(
        `Decisions: ${summary.decisions}; pending receipts: ${summary.pendingReceipts}; receipt transactions: ${summary.receiptTransactions.length}`
      );
      return {
        schemaVersion: 1,
        mode: "local-cre-simulation",
        paymentSigned: false,
        tokenTransfers: false,
        donAuthenticated: false,
        reviews,
        audit: summary,
      };
    } finally {
      await auditor?.close();
      provider.destroy();
    }
  }
);
