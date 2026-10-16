const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentPayStream", function () {
    let AgentPayStream;
    let agentPayStream;
    let MockUSD;
    let mockUSD;
    let owner;
    let recipient;
    let otherAccount;

    beforeEach(async function () {
        [owner, recipient, otherAccount] = await ethers.getSigners();

        // Deploy MockUSD
        MockUSD = await ethers.getContractFactory("MockUSD");
        mockUSD = await MockUSD.deploy();
        await mockUSD.waitForDeployment();

        // Deploy AgentPayStream
        AgentPayStream = await ethers.getContractFactory("AgentPayStream");
        agentPayStream = await AgentPayStream.deploy(await mockUSD.getAddress());
        await agentPayStream.waitForDeployment();

        // Mint tokens to owner
        await mockUSD.mint(owner.address, ethers.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should set the right tUSD token address", async function () {
            expect(await agentPayStream.paymentToken()).to.equal(await mockUSD.getAddress());
        });
    });

    describe("Stream Creation", function () {
        it("Should create a stream successfully", async function () {
            const amount = ethers.parseEther("100");
            const duration = 100; // 100 seconds

            // Approve AgentPayStream to spend tokens
            await mockUSD.approve(await agentPayStream.getAddress(), amount);

            const tx = await agentPayStream.createStream(recipient.address, duration, amount, "metadata");
            const receipt = await tx.wait();

            // Check event
            const event = receipt.logs.find(log => {
                try {
                    return agentPayStream.interface.parseLog(log).name === 'StreamCreated';
                } catch (e) {
                    return false;
                }
            });
            expect(event).to.not.be.undefined;

            const args = agentPayStream.interface.parseLog(event).args;
            expect(args.recipient).to.equal(recipient.address);
            expect(args.totalAmount).to.equal(amount);
            expect(args.metadata).to.equal("metadata");
        });

        it("Should fail if allowance is insufficient", async function () {
            const amount = ethers.parseEther("100");
            const duration = 100;

            await expect(
                agentPayStream.createStream(recipient.address, duration, amount, "metadata")
            ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
        });
    });

    describe("Withdrawal", function () {
        it("Should allow withdrawal of accrued tokens", async function () {
            const amount = ethers.parseEther("100");
            const duration = 100;

            await mockUSD.approve(await agentPayStream.getAddress(), amount);
            await agentPayStream.createStream(recipient.address, duration, amount, "metadata");

            // Increase time by 50 seconds
            await ethers.provider.send("evm_increaseTime", [50]);
            await ethers.provider.send("evm_mine");

            const streamId = 1;
            const claimable = await agentPayStream.getClaimableBalance(streamId);

            // Approx 50 tokens
            expect(claimable).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("1"));

            const recipientBalanceBefore = await mockUSD.balanceOf(recipient.address);
            await agentPayStream.connect(recipient).withdrawFromStream(streamId);
            const recipientBalanceAfter = await mockUSD.balanceOf(recipient.address);

            expect(recipientBalanceAfter - recipientBalanceBefore).to.be.closeTo(claimable, ethers.parseEther("2"));
        });
    });

    describe("Cancellation", function () {
        it("Should allow sender to cancel and refund remaining", async function () {
            const amount = ethers.parseEther("100");
            const duration = 100;

            await mockUSD.approve(await agentPayStream.getAddress(), amount);
            await agentPayStream.createStream(recipient.address, duration, amount, "metadata");

            // Increase time by 50 seconds
            await ethers.provider.send("evm_increaseTime", [50]);
            await ethers.provider.send("evm_mine");

            const streamId = 1;

            const senderBalanceBefore = await mockUSD.balanceOf(owner.address);
            await agentPayStream.cancelStream(streamId);
            const senderBalanceAfter = await mockUSD.balanceOf(owner.address);

            // Should get back approx 50 tokens
            expect(senderBalanceAfter - senderBalanceBefore).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("1"));

            expect(await agentPayStream.isStreamActive(streamId)).to.be.false;
        });
    });

    describe("Active Check", function () {
        it("Should return true for active stream", async function () {
            const amount = ethers.parseEther("100");
            const duration = 100;
            await mockUSD.approve(await agentPayStream.getAddress(), amount);
            await agentPayStream.createStream(recipient.address, duration, amount, "metadata");
            expect(await agentPayStream.isStreamActive(1)).to.be.true;
        });
    });
});
