const {expect}=require('chai');
const {ethers}=require('hardhat');
const fields=[['action','uint8'],['agent','address'],['recipient','address'],['amount','uint256'],['duration','uint256'],['metadataHash','bytes32'],['sessionId','bytes32'],['streamId','uint256'],['nonce','uint256'],['deadline','uint64'],['decisionHash','bytes32']].map(([name,type])=>({name,type}));
describe('AgentPayGuardedStream / local policy authority',function(){
 let agent,recipient,policy,recovery,other,token,stream,metadata,domain;
 beforeEach(async()=>{
  [agent,recipient,policy,recovery,other]=await ethers.getSigners();
  token=await (await ethers.getContractFactory('DemoUSDC')).deploy();
  stream=await (await ethers.getContractFactory('AgentPayGuardedStream')).deploy(await token.getAddress(),agent.address,policy.address,recovery.address);
  await token.mint(agent.address,1000000n);
  await token.approve(await stream.getAddress(),1000000n);
  metadata=JSON.stringify({sessionId:ethers.id('session'),quoteId:ethers.id('quote')});
  domain={name:'AgentPayGuardedStream',version:'1',chainId:(await ethers.provider.getNetwork()).chainId,verifyingContract:await stream.getAddress()};
 });
 async function permit(overrides={}){
  return {action:1,agent:agent.address,recipient:recipient.address,amount:10000n,duration:1000n,metadataHash:ethers.keccak256(ethers.toUtf8Bytes(metadata)),sessionId:ethers.id('session'),streamId:0n,nonce:await stream.nextNonce(),deadline:(await ethers.provider.getBlock('latest')).timestamp+300,decisionHash:ethers.id('validated CRE evidence'),...overrides};
 }
 const sign=(p,signer=policy,d=domain)=>signer.signTypedData(d,{Permit:fields},p);
 async function open(){const p=await permit();await stream.createStreamWithPermit(p,metadata,await sign(p));return p;}
 async function closePermit(overrides={}){return permit({action:2,streamId:1n,...overrides});}
 it('requires three distinct authorities and a contract token',async()=>{
  const f=await ethers.getContractFactory('AgentPayGuardedStream');
  await expect(f.deploy(await token.getAddress(),agent.address,agent.address,recovery.address)).to.be.revertedWith('Separate authorities required');
  await expect(f.deploy(await token.getAddress(),agent.address,policy.address,agent.address)).to.be.revertedWith('Separate authorities required');
  await expect(f.deploy(other.address,agent.address,policy.address,recovery.address)).to.be.revertedWith('Token required');
 });
 it('rejects unsigned legacy entry points even with balance and unlimited allowance',async()=>{
  await expect(stream.createStream(recipient.address,1000,10000,metadata)).to.be.revertedWith('Policy approval required');
  await open();
  await expect(stream.cancelStream(1)).to.be.revertedWith('Policy approval required');
  await expect(stream.connect(recipient).cancelStream(1)).to.be.revertedWith('Policy approval required');
 });
 it('accepts an exact EIP-712 approval and consumes its nonce with escrow only',async()=>{
  const p=await permit();expect(await stream.permitDigest(p)).to.equal(ethers.TypedDataEncoder.hash(domain,{Permit:fields},p));
  await expect(stream.createStreamWithPermit(p,metadata,await sign(p))).to.emit(stream,'PolicyApprovalConsumed').withArgs(0,1,1,p.decisionHash);
  expect(await token.balanceOf(await stream.getAddress())).to.equal(10000);
  expect(await token.balanceOf(recipient.address)).to.equal(0);
  expect(await stream.nextNonce()).to.equal(1);
  expect(await stream.activeStreamId()).to.equal(1);
 });
 it('rejects fabricated, agent-signed, cross-chain and cross-contract approvals',async()=>{
  const p=await permit();
  for(const signer of [agent,other,recovery])await expect(stream.createStreamWithPermit(p,metadata,await sign(p,signer))).to.be.revertedWith('Invalid policy signer');
  for(const d of [{...domain,chainId:1},{...domain,verifyingContract:other.address}])await expect(stream.createStreamWithPermit(p,metadata,await sign(p,policy,d))).to.be.revertedWith('Invalid policy signer');
  await expect(stream.createStreamWithPermit(p,metadata,'0x')).to.be.revertedWith('Invalid signature');
  expect(await stream.nextNonce()).to.equal(0);
 });
 it('binds every signed action field and metadata; caller cannot change the intent',async()=>{
  const p=await permit(),signature=await sign(p);
  for(const patch of [{recipient:other.address},{amount:9000},{duration:900},{sessionId:ethers.id('other')},{decisionHash:ethers.id('forged')}])await expect(stream.createStreamWithPermit({...p,...patch},metadata,signature)).to.be.revertedWith('Invalid policy signer');
  await expect(stream.createStreamWithPermit(p,'different',signature)).to.be.revertedWith('Metadata mismatch');
  await expect(stream.connect(other).createStreamWithPermit(p,metadata,signature)).to.be.revertedWith('Only agent');
  await expect(stream.createStreamWithPermit({...p,action:2},metadata,signature)).to.be.revertedWith('OPEN required');
 });
 it('rejects expired or overlong approvals, nonce substitution and deposit/rate violations',async()=>{
  for(const patch of [{deadline:1},{deadline:(await ethers.provider.getBlock('latest')).timestamp+1000}]){const p=await permit(patch);await expect(stream.createStreamWithPermit(p,metadata,await sign(p))).to.be.revertedWith('Invalid expiry');}
  let p=await permit({nonce:1});await expect(stream.createStreamWithPermit(p,metadata,await sign(p))).to.be.revertedWith('Invalid nonce');
  p=await permit({amount:10001});await expect(stream.createStreamWithPermit(p,metadata,await sign(p))).to.be.revertedWith('Deposit cap');
  p=await permit({duration:1});await expect(stream.createStreamWithPermit(p,metadata,await sign(p))).to.be.revertedWith('Invalid rate or duration');
 });
 it('blocks duplicate active funding and session replay after closure',async()=>{
  const old=await open(),p=await permit({sessionId:ethers.id('new')});
  await expect(stream.createStreamWithPermit(p,metadata,await sign(p))).to.be.revertedWith('Active stream exists');
  const c=await closePermit();await stream.cancelStreamWithPermit(c,await sign(c));
  await expect(stream.createStreamWithPermit(old,metadata,await sign(old))).to.be.revertedWith('Session already funded');
  const fresh=await permit({sessionId:ethers.id('new')});await stream.createStreamWithPermit(fresh,metadata,await sign(fresh));
  expect(await stream.activeStreamId()).to.equal(2);
 });
 it('does not let the agent or recipient close early without the separate policy signature',async()=>{
  await open();const c=await closePermit();
  await expect(stream.cancelStreamWithPermit(c,await sign(c,agent))).to.be.revertedWith('Invalid policy signer');
  await expect(stream.connect(recipient).cancelStreamWithPermit(c,await sign(c))).to.be.revertedWith('Only agent');
  const changed={...c,amount:9000};await expect(stream.cancelStreamWithPermit(changed,await sign(changed))).to.be.revertedWith('Stream intent mismatch');
 });
 it('pays accrued earnings and refunds the remainder exactly once after policy closure',async()=>{
  await open();await ethers.provider.send('evm_increaseTime',[20]);await ethers.provider.send('evm_mine',[]);
  const before=await token.balanceOf(agent.address),c=await closePermit(),signature=await sign(c);
  const receipt=await (await stream.cancelStreamWithPermit(c,signature)).wait();
  const event=receipt.logs.map(l=>{try{return stream.interface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='StreamCancelled');
  expect(event.args.recipientBalance).to.be.greaterThan(0);expect(event.args.senderBalance+event.args.recipientBalance).to.equal(10000);
  expect(await token.balanceOf(agent.address)-before).to.equal(event.args.senderBalance);
  expect(await token.balanceOf(recipient.address)).to.equal(event.args.recipientBalance);
  expect(await stream.activeStreamId()).to.equal(0);
  await expect(stream.cancelStreamWithPermit(c,signature)).to.be.revertedWith('Active CLOSE required');
 });
 it('allows recipient withdrawals and releases rounding remainder at expiry',async()=>{
  const p=await permit({amount:9999});await stream.createStreamWithPermit(p,metadata,await sign(p));
  await ethers.provider.send('evm_increaseTime',[20]);await ethers.provider.send('evm_mine',[]);
  await expect(stream.withdrawFromStream(1)).to.be.revertedWith('Only recipient');
  await stream.connect(recipient).withdrawFromStream(1);
  await ethers.provider.send('evm_increaseTime',[1000]);await ethers.provider.send('evm_mine',[]);
  await stream.connect(recipient).withdrawFromStream(1);
  expect(await token.balanceOf(recipient.address)).to.equal(9999);
 });
 it('keeps recovery unavailable to agent/policy keys and works with the signer offline',async()=>{
  await open();for(const actor of [agent,policy,recipient])await expect(stream.connect(actor).recoveryClose(1)).to.be.revertedWith('Only recovery owner');
  await expect(stream.connect(recovery).recoveryClose(1)).to.emit(stream,'RecoveryClosed').withArgs(1,recovery.address);
  expect((await stream.streams(1)).isActive).to.equal(false);
 });
 it('reverts nonce/session consumption when the token deposit fails',async()=>{
  await token.approve(await stream.getAddress(),0);const p=await permit(),signature=await sign(p);
  await expect(stream.createStreamWithPermit(p,metadata,signature)).to.be.reverted;
  expect(await stream.nextNonce()).to.equal(0);expect(await stream.usedSessions(p.sessionId)).to.equal(false);
  await token.approve(await stream.getAddress(),10000);await stream.createStreamWithPermit(p,metadata,signature);
 });
});
