import { Contract, Interface, keccak256 } from "ethers";
import { readFile } from "node:fs/promises";
import { durableWrite, leafHash, merkle, verifyProof } from "./journal.mjs";
export const JOURNAL_ABI = [
  "function writer() view returns(address)",
  "function nextSequence() view returns(uint256)",
  "function batches(bytes32) view returns(uint256 firstSequence,uint256 count,uint256 timestamp)",
  "function anchor(bytes32,uint256,uint256)",
  "function verify(bytes32,bytes32,bytes32[]) view returns(bool)",
  "event DecisionsAnchored(bytes32 indexed root,uint256 firstSequence,uint256 count)",
];
const iface = new Interface(JOURNAL_ABI);
export async function verifyBatchReceipt(provider, contract, batch, receipt) {
  if (!receipt || receipt.hash !== batch.transactionHash || receipt.status !== 1 ||
      (await receipt.confirmations()) < 2)
    throw new Error("Journal receipt pending confirmations");
  if (receipt.to?.toLowerCase() !== batch.address.toLowerCase() ||
      receipt.from?.toLowerCase() !== batch.writer.toLowerCase())
    throw new Error("Journal receipt domain mismatch");
  const matchesBlock = async () => {
    const block = await provider.getBlock(receipt.blockNumber);
    if (!block || block.hash !== receipt.blockHash)
      throw new Error("Journal receipt block changed or unavailable");
  };
  await matchesBlock();
  const events = receipt.logs
    .filter(log => log.address.toLowerCase() === batch.address.toLowerCase())
    .map(log => iface.parseLog(log));
  const event = events.find(log => log?.name === "DecisionsAnchored" &&
    log.args.root === batch.root &&
    log.args.firstSequence === BigInt(batch.firstSequence) &&
    log.args.count === BigInt(batch.entries.length));
  if (!event) throw new Error("Journal receipt anchor event mismatch");
  // A load-balanced RPC's latest node can lag the node that confirmed the
  // receipt. Read its exact block and bind it to the canonical receipt hash.
  const anchored = await contract.batches(batch.root, {blockTag: receipt.blockNumber});
  await matchesBlock();
  if (anchored.firstSequence !== BigInt(batch.firstSequence) ||
      anchored.count !== BigInt(batch.entries.length))
    throw new Error("Receipt root or sequence mismatch at confirmed block");
  return receipt.blockNumber;
}
export async function verifyDeployment(provider, address, writer) {
  if ((await provider.getNetwork()).chainId !== 11155111n)
    throw new Error("Journal requires Sepolia");
  const artifact = JSON.parse(
    await readFile(
      new URL(
        "../../artifacts/contracts/AgentPayDecisionJournal.sol/AgentPayDecisionJournal.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  if (
    (await provider.getCode(address)).toLowerCase() !==
    artifact.deployedBytecode.toLowerCase()
  )
    throw new Error("Unexpected receipt contract runtime");
  const contract = new Contract(address, JOURNAL_ABI, provider);
  if ((await contract.writer()).toLowerCase() !== writer.toLowerCase())
    throw new Error("Journal writer does not match signing wallet");
  return contract;
}
export async function anchorPending({ journal, provider, wallet, address }) {
  const contract = await verifyDeployment(provider, address, wallet.address);
  const status = await journal.status();
  for (const batch of status.batches.filter((b) => b.state === "anchored")) {
    if (
      batch.address.toLowerCase() !== address.toLowerCase() ||
      batch.writer.toLowerCase() !== wallet.address.toLowerCase() ||
      batch.chainId !== 11155111
    )
      throw new Error("Receipt journal domain mismatch");
    const observed = await contract.batches(batch.root);
    if (
      observed.count !== BigInt(batch.entries.length) ||
      observed.firstSequence !== BigInt(batch.firstSequence)
    )
      throw new Error(
        "Previously anchored root missing or changed; inspect possible reorganization"
      );
  }
  // Reconcile a journaled root before considering another write. Uncertain
  // broadcasts are never silently retried with another nonce.
  const uncertain = status.batches.filter((b) => b.state !== "anchored");
  for (const batch of uncertain) {
    try {
      const receipt = await provider.getTransactionReceipt(
        batch.transactionHash
      );
      await verifyBatchReceipt(provider, contract, batch, receipt);
      batch.state = "anchored";
      batch.blockNumber = receipt.blockNumber;
      batch.gasUsed = receipt.gasUsed.toString();
      batch.feeWei = receipt.fee.toString();
      await durableWrite(journal.file("batches", batch.root), batch);
    } catch {
      throw new Error(
        `Journal broadcast uncertain: inspect ${batch.transactionHash}; no automatic resubmission`
      );
    }
  }
  const current = await journal.status();
  if (!current.pendingReceipts.length) return current.batches;
  let sequence = Number(await contract.nextSequence());
  const domain = { chainId: 11155111, address, writer: wallet.address };
  for (let offset = 0; offset < current.pendingReceipts.length; offset += 256) {
    const entries = current.pendingReceipts
      .slice(offset, offset + 256)
      .map((e, n) => ({ ...e, sequence: sequence + n }));
    const tree = merkle(entries.map((e) => leafHash(domain, e)));
    const transaction = await wallet.populateTransaction({
      to: address,
      data: iface.encodeFunctionData("anchor", [
        tree.root,
        sequence,
        entries.length,
      ]),
    });
    if (
      transaction.chainId !== 11155111n ||
      BigInt(transaction.gasLimit) *
        BigInt(transaction.maxFeePerGas || transaction.gasPrice || 0) >
        10000000000000000n
    )
      throw new Error(
        "Receipt transaction exceeds Sepolia or 0.01 test ETH gas-exposure limit"
      );
    const raw = await wallet.signTransaction(transaction),
      hash = keccak256(raw);
    const batch = {
      schemaVersion: 1,
      state: "submitting",
      ...domain,
      firstSequence: sequence,
      root: tree.root,
      entries: entries.map((e, n) => ({ ...e, proof: tree.proofs[n] })),
      transactionHash: hash,
    };
    await durableWrite(journal.file("batches", tree.root), batch);
    let receipt;
    try {
      receipt = await (
        await provider.broadcastTransaction(raw)
      ).wait(2, 120000);
    } catch {
      throw new Error(
        `Journal broadcast uncertain: inspect ${hash}; no automatic resubmission`
      );
    }
    if (!receipt || receipt.status !== 1)
      throw new Error(`Journal anchor failed: ${hash}`);
    await verifyBatchReceipt(provider, contract, batch, receipt);
    batch.state = "anchored";
    batch.blockNumber = receipt.blockNumber;
    batch.gasUsed = receipt.gasUsed.toString();
    batch.feeWei = receipt.fee.toString();
    await durableWrite(journal.file("batches", tree.root), batch);
    sequence += entries.length;
  }
  return (await journal.status()).batches;
}
export async function assertAnchored(
  journal,
  provider,
  address,
  pointer,
  writer
) {
  const status = await journal.status();
  const batch = status.batches.find(
    (b) =>
      b.state === "anchored" &&
      b.entries.some(
        (e) =>
          e.intentId === pointer.intentId && e.blobHash === pointer.blobHash
      )
  );
  if (
    !batch ||
    batch.address.toLowerCase() !== address.toLowerCase() ||
    batch.writer.toLowerCase() !== writer.toLowerCase() ||
    batch.chainId !== 11155111
  )
    throw new Error("Required onchain decision receipt missing");
  const entry = batch.entries.find((e) => e.intentId === pointer.intentId);
  const leaf = leafHash(batch, entry);
  if (!verifyProof(leaf, entry.proof, batch.root))
    throw new Error("Decision inclusion proof invalid");
  const contract = await verifyDeployment(provider, address, writer);
  const receipt = await provider.getTransactionReceipt(batch.transactionHash);
  const blockTag = await verifyBatchReceipt(provider, contract, batch, receipt);
  if (!(await contract.verify(batch.root, leaf, entry.proof, {blockTag})))
    throw new Error("Receipt no longer verifies onchain");
  await journal.blob(pointer.blobHash);
  return batch;
}
