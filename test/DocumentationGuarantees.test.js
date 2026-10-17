const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Consequential documented payment bounds", function () {
  it("rejects zero, permits a smaller payment, and consumes all remaining authorization", async () => {
    const [owner, forwarder, agent, recipient] = await ethers.getSigners();
    const id = ethers.id("doc-partial"),
      workflow = ethers.id("doc-workflow");
    const guard = await (
      await ethers.getContractFactory("AgentPayGuard")
    ).deploy(forwarder.address, workflow);
    const settlement = await (
      await ethers.getContractFactory("AgentPaySettlement")
    ).deploy(await guard.getAddress());
    const token = await (
      await ethers.getContractFactory("SixDecimalToken")
    ).deploy();
    await guard.setSettlement(await settlement.getAddress());
    await token.mint(agent.address, 10000n);
    await token.connect(agent).approve(await settlement.getAddress(), 10000n);
    const report = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "uint256",
        "address",
        "bytes32",
        "address",
        "address",
        "address",
        "uint256",
        "uint64",
        "bool",
      ],
      [
        31337,
        await guard.getAddress(),
        id,
        agent.address,
        recipient.address,
        await token.getAddress(),
        10000n,
        (await time.latest()) + 300,
        true,
      ]
    );
    const metadata = ethers.solidityPacked(
      ["bytes32", "bytes10", "address"],
      [workflow, "0x00000000000000000000", owner.address]
    );
    await guard.connect(forwarder).onReport(metadata, report);
    await expect(
      settlement
        .connect(agent)
        .settle(id, recipient.address, await token.getAddress(), 0n)
    ).to.be.revertedWith("Payment not authorized");
    await settlement
      .connect(agent)
      .settle(id, recipient.address, await token.getAddress(), 6000n);
    expect(await token.balanceOf(recipient.address)).to.equal(6000n);
    expect(await guard.consumed(id)).to.equal(true);
    await expect(
      settlement
        .connect(agent)
        .settle(id, recipient.address, await token.getAddress(), 4000n)
    ).to.be.revertedWith("Payment not authorized");
  });

  it("releases division dust after prior withdrawal at expiry; closing then prevents further withdrawal", async () => {
    const [sender, recipient] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("MockUSD")).deploy();
    const stream = await (
      await ethers.getContractFactory("AgentPayStream")
    ).deploy(await token.getAddress());
    // 100 raw units / 30 seconds leaves 10 raw units of division dust.
    await token.approve(await stream.getAddress(), 100n);
    await stream.createStream(recipient.address, 30, 100n, "{}");
    const { startTime, stopTime } = await stream.streams(1);
    await time.setNextBlockTimestamp(startTime + 10n);
    await stream.connect(recipient).withdrawFromStream(1);
    expect(await token.balanceOf(recipient.address)).to.equal(30n);
    await time.increaseTo(stopTime);
    expect(await stream.isStreamActive(1)).to.equal(true);
    expect(await stream.getClaimableBalance(1)).to.equal(70n);
    await stream.connect(recipient).withdrawFromStream(1);
    expect(await token.balanceOf(recipient.address)).to.equal(100n);
    await stream.connect(sender).cancelStream(1);
    expect(await stream.isStreamActive(1)).to.equal(false);
    await expect(
      stream.connect(recipient).withdrawFromStream(1)
    ).to.be.revertedWith("AgentPayStream: Stream is not active.");
  });
});
