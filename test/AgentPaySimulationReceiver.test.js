const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('isolated CRE simulation receiver', function () {
  let receiver, forwarder, owner, report;
  const encode = d => ethers.AbiCoder.defaultAbiCoder().encode(['uint256','address','bytes32','address','address','address','uint256','uint64','bool'], d);
  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    forwarder = await (await ethers.getContractFactory('MockCREForwarder')).deploy();
    receiver = await (await ethers.getContractFactory('AgentPaySimulationReceiver')).deploy(await forwarder.getAddress(), true);
    report = [31337, await receiver.getAddress(), ethers.id('demo-request'), owner.address, owner.address, owner.address, 1n, (await time.latest()) + 300, true];
  });
  it('records empty-metadata mock delivery while labeling it as simulation only', async () => {
    await expect(forwarder.deliver(await receiver.getAddress(), '0x', encode(report))).to.emit(receiver, 'SimulationReportRecorded');
    expect(await receiver.recorded(report[2])).to.equal(true);
    expect(await receiver.simulationOnly()).to.equal(true);
    expect(await receiver.skipWorkflowIdentity()).to.equal(true);
  });
  it('requires explicit opt-in and a deployed forwarder', async () => {
    const factory = await ethers.getContractFactory('AgentPaySimulationReceiver');
    await expect(factory.deploy(await forwarder.getAddress(), false)).to.be.revertedWith('Explicit demo opt-in required');
    await expect(factory.deploy(owner.address, true)).to.be.revertedWith('Forwarder must be a contract');
  });
  it('rejects a direct caller even with empty metadata', async () => {
    await expect(receiver.onReport('0x', encode(report))).to.be.revertedWith('Only mock forwarder');
  });
  it('preserves replay, destination, and expiry bounds', async () => {
    const wrong = [...report]; wrong[0] = 1;
    await expect(forwarder.deliver(await receiver.getAddress(), '0x', encode(wrong))).to.be.revertedWith('Wrong destination');
    const expired = [...report]; expired[7] = (await time.latest()) - 1;
    await expect(forwarder.deliver(await receiver.getAddress(), '0x', encode(expired))).to.be.revertedWith('Invalid expiry');
    await forwarder.deliver(await receiver.getAddress(), '0x', encode(report));
    await expect(forwarder.deliver(await receiver.getAddress(), '0x', encode(report))).to.be.revertedWith('Report replay');
  });
  it('cannot be connected to the settlement payment path', async () => {
    const settlement = await (await ethers.getContractFactory('AgentPaySettlement')).deploy(await receiver.getAddress());
    await forwarder.deliver(await receiver.getAddress(), '0x', encode(report));
    await expect(settlement.settle(report[2], owner.address, owner.address, 1n)).to.be.reverted;
    expect(receiver.interface.hasFunction('consume')).to.equal(false);
    expect(receiver.interface.hasFunction('canPay')).to.equal(false);
  });
  it('leaves the strict production consumer closed to missing identity', async () => {
    const strict = await (await ethers.getContractFactory('AgentPayGuard')).deploy(await forwarder.getAddress(), ethers.id('production'));
    await expect(forwarder.deliver(await strict.getAddress(), '0x', encode(report))).to.be.revertedWith('Invalid metadata');
  });
});
