import { readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import {
  Contract,
  JsonRpcProvider,
  FetchRequest,
  Interface,
  keccak256,
} from "ethers";
import assert from "node:assert/strict";
import { JOURNAL_ABI } from "../demo/audit/anchor.mjs";
import { leafHash } from "../demo/audit/journal.mjs";
dotenv.config({ quiet: true });
const manifest = JSON.parse(
  await readFile(
    new URL("../docs/evidence/spend-review/manifest.json", import.meta.url),
    "utf8"
  )
);
const deployment = JSON.parse(
  await readFile(
    new URL("../docs/deployment/decision-journal.json", import.meta.url),
    "utf8"
  )
);
const req = new FetchRequest(
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
);
req.timeout = 15000;
const provider = new JsonRpcProvider(req, undefined, {
  batchMaxCount: 1,
  cacheTimeout: -1,
});
try {
  assert.equal((await provider.getNetwork()).chainId, 11155111n);
  assert.equal(
    keccak256(await provider.getCode(deployment.address)),
    deployment.runtimeCodeHash
  );
  const contract = new Contract(deployment.address, JOURNAL_ABI, provider),
    iface = new Interface(JOURNAL_ABI);
  assert.equal(
    (await contract.writer()).toLowerCase(),
    deployment.writer.toLowerCase()
  );
  const receipts = [];
  for (const b of manifest.batches) {
    const tx = await provider.getTransaction(b.transactionHash),
      receipt = await provider.getTransactionReceipt(b.transactionHash);
    assert.equal(receipt.status, 1);
    assert.ok((await receipt.confirmations()) >= 2);
    assert.equal(tx.to.toLowerCase(), deployment.address.toLowerCase());
    assert.equal(tx.from.toLowerCase(), deployment.writer.toLowerCase());
    const call = iface.parseTransaction(tx);
    assert.equal(call.name, "anchor");
    assert.equal(call.args[0], b.root);
    assert.equal(call.args[1], BigInt(b.firstSequence));
    assert.equal(call.args[2], BigInt(b.entries.length));
    const event = receipt.logs
      .filter(
        (l) => l.address.toLowerCase() === deployment.address.toLowerCase()
      )
      .map((l) => iface.parseLog(l))
      .find((l) => l?.name === "DecisionsAnchored");
    assert.equal(event.args.root, b.root);
    assert.equal(event.args.count, BigInt(b.entries.length));
    for (const entry of b.entries)
      assert.equal(
        await contract.verify(b.root, leafHash(b, entry), entry.proof),
        true
      );
    receipts.push({
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      root: b.root,
      firstSequence: b.firstSequence,
      count: b.entries.length,
      gasUsed: receipt.gasUsed.toString(),
      feeWei: receipt.fee.toString(),
      proofsVerified: b.entries.length,
    });
  }
  const token = new Contract(
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    ["function balanceOf(address) view returns(uint256)"],
    provider
  );
  const result = {
    verifiedAt: new Date().toISOString(),
    chainId: 11155111,
    receiptContract: deployment.address,
    writer: deployment.writer,
    runtimeCodeMatchesDeployment: true,
    receipts,
    writerUsdcBalanceRaw: (await token.balanceOf(deployment.writer)).toString(),
    donAuthenticated: false,
  };
  await writeFile(
    new URL(
      "../docs/evidence/spend-review/rpc-verification.json",
      import.meta.url
    ),
    JSON.stringify(result, null, 2) + "\n"
  );
  console.log(JSON.stringify(result));
} finally {
  provider.destroy();
}
