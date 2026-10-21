const { expect } = require("chai");
const { ethers } = require("hardhat");
describe("Local operator decision receipt journal", function () {
  let journal, writer, other;
  beforeEach(async () => {
    [writer, other] = await ethers.getSigners();
    journal = await (
      await ethers.getContractFactory("AgentPayDecisionJournal")
    ).deploy();
  });
  it("anchors batches of ALLOW/BLOCK/ERROR record hashes without changing token balances", async () => {
    const value = await journal.leaf(1, ethers.id("intent"), ethers.id("blob"));
    await expect(journal.anchor(value, 1, 1))
      .to.emit(journal, "DecisionsAnchored")
      .withArgs(value, 1, 1);
    expect(await journal.verify(value, value, [])).to.equal(true);
    expect(await journal.nextSequence()).to.equal(2);
  });
  it("rejects another writer, duplicate roots, noncontiguous sequences and oversized batches", async () => {
    const root = ethers.id("root");
    await expect(journal.connect(other).anchor(root, 1, 1)).to.be.revertedWith(
      "Only writer"
    );
    for (const [first, count] of [
      [2, 1],
      [1, 0],
      [1, 257],
    ])
      await expect(journal.anchor(root, first, count)).to.be.revertedWith(
        "Invalid sequence"
      );
    await journal.anchor(root, 1, 1);
    await expect(journal.anchor(root, 2, 1)).to.be.revertedWith("Invalid root");
  });
  it("binds leaves to chain, receipt contract, writer, intent, blob and sequence", async () => {
    const id = ethers.id("intent"),
      blob = ethers.id("blob");
    const leaf = await journal.leaf(1, id, blob);
    expect(leaf).to.equal(
      ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256", "address", "address", "uint256", "bytes32", "bytes32"],
          [31337, await journal.getAddress(), writer.address, 1, id, blob]
        )
      )
    );
    const otherJournal = await (
      await ethers.getContractFactory("AgentPayDecisionJournal")
    ).deploy();
    expect(await otherJournal.leaf(1, id, blob)).not.to.equal(leaf);
    await journal.anchor(leaf, 1, 1);
    expect(
      await journal.verify(leaf, await journal.leaf(2, id, blob), [])
    ).to.equal(false);
    expect(await journal.verify(ethers.id("unanchored"), leaf, [])).to.equal(
      false
    );
  });
});
