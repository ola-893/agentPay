const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('CRE authorization and token settlement', function () {
  let owner, forwarder, agent, recipient, other, guard, settlement, token, decision, metadata;
  const workflowId = ethers.id('agentpay-payment-guard');
  const requestId = ethers.id('request-001');
  const amount = ethers.parseEther('1');
  const encode = d => ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'bytes32', 'address', 'address', 'address', 'uint256', 'uint64', 'bool'], d);

  beforeEach(async () => {
    [owner, forwarder, agent, recipient, other] = await ethers.getSigners();
    guard = await (await ethers.getContractFactory('AgentPayGuard')).deploy(forwarder.address, workflowId);
    settlement = await (await ethers.getContractFactory('AgentPaySettlement')).deploy(await guard.getAddress());
    token = await (await ethers.getContractFactory('MockUSD')).deploy();
    await guard.setSettlement(await settlement.getAddress());
    await token.mint(agent.address, amount * 10n);
    await token.connect(agent).approve(await settlement.getAddress(), amount * 10n);
    metadata = ethers.solidityPacked(['bytes32', 'bytes10', 'address', 'bytes2'], [workflowId, '0x00000000000000000000', owner.address, '0x0001']);
    decision = [31337, await guard.getAddress(), requestId, agent.address, recipient.address, await token.getAddress(), amount, (await time.latest()) + 300, true];
  });

  it('accepts a workflow report and settles exactly one authorized payment', async () => {
    await guard.connect(forwarder).onReport(metadata, encode(decision));
    await expect(settlement.connect(agent).settle(requestId, recipient.address, await token.getAddress(), amount))
      .to.emit(settlement, 'PaymentSettled').withArgs(requestId, agent.address, recipient.address, await token.getAddress(), amount);
    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    await expect(settlement.connect(agent).settle(requestId, recipient.address, await token.getAddress(), amount)).to.be.revertedWith('Payment not authorized');
  });

  it('rejects callers other than the trusted forwarder', async () => {
    await expect(guard.onReport(metadata, encode(decision))).to.be.revertedWith('Only forwarder');
  });
  it('rejects another workflow even through the same forwarder', async () => {
    const wrong = ethers.solidityPacked(['bytes32', 'bytes10', 'address'], [ethers.id('other'), '0x00000000000000000000', owner.address]);
    await expect(guard.connect(forwarder).onReport(wrong, encode(decision))).to.be.revertedWith('Wrong workflow');
  });
  it('rejects missing workflow metadata', async () => {
    await expect(guard.connect(forwarder).onReport('0x', encode(decision))).to.be.revertedWith('Invalid metadata');
  });
  it('rejects cross-chain and cross-contract replay', async () => {
    for (const d of [[1, ...decision.slice(1)], [decision[0], other.address, ...decision.slice(2)]]) {
      await expect(guard.connect(forwarder).onReport(metadata, encode(d))).to.be.revertedWith('Wrong destination');
    }
  });
  it('rejects a duplicate request report', async () => {
    await guard.connect(forwarder).onReport(metadata, encode(decision));
    await expect(guard.connect(forwarder).onReport(metadata, encode(decision))).to.be.revertedWith('Report replay');
  });
  it('rejects expired and excessive authorization lifetimes', async () => {
    for (const expiry of [(await time.latest()) - 1, (await time.latest()) + 7200]) {
      const d = [...decision]; d[7] = expiry;
      await expect(guard.connect(forwarder).onReport(metadata, encode(d))).to.be.revertedWith('Invalid expiry');
    }
  });
  it('cannot spend a denied report', async () => {
    const d = [...decision]; d[8] = false;
    await guard.connect(forwarder).onReport(metadata, encode(d));
    await expect(settlement.connect(agent).settle(requestId, recipient.address, await token.getAddress(), amount)).to.be.revertedWith('Payment not authorized');
  });
  it('binds authorization to the agent, recipient, token, and amount', async () => {
    await guard.connect(forwarder).onReport(metadata, encode(decision));
    for (const args of [[other, recipient.address, await token.getAddress(), amount], [agent, other.address, await token.getAddress(), amount], [agent, recipient.address, other.address, amount], [agent, recipient.address, await token.getAddress(), amount + 1n]]) {
      await expect(settlement.connect(args[0]).settle(requestId, ...args.slice(1))).to.be.revertedWith('Payment not authorized');
    }
  });
  it('expires before settlement', async () => {
    await guard.connect(forwarder).onReport(metadata, encode(decision));
    await time.increase(301);
    await expect(settlement.connect(agent).settle(requestId, recipient.address, await token.getAddress(), amount)).to.be.revertedWith('Payment not authorized');
  });
  it('only allows the configured settlement contract to consume reports', async () => {
    await guard.connect(forwarder).onReport(metadata, encode(decision));
    await expect(guard.consume(requestId, agent.address, recipient.address, await token.getAddress(), amount)).to.be.revertedWith('Only settlement');
    await expect(guard.connect(other).setSettlement(other.address)).to.be.revertedWith('Only owner');
  });
  it('rolls authorization back if token transfer fails', async () => {
    await guard.connect(forwarder).onReport(metadata, encode(decision));
    await token.connect(agent).approve(await settlement.getAddress(), 0);
    await expect(settlement.connect(agent).settle(requestId, recipient.address, await token.getAddress(), amount)).to.be.revertedWith('Token transfer failed');
    expect(await guard.consumed(requestId)).to.equal(false);
  });
  it('advertises the CRE receiver and ERC165 interfaces', async () => {
    expect(await guard.supportsInterface(guard.interface.getFunction('onReport').selector)).to.equal(true);
    expect(await guard.supportsInterface('0x01ffc9a7')).to.equal(true);
    expect(await guard.supportsInterface('0xffffffff')).to.equal(false);
  });
});
