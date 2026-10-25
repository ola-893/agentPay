import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JsonRpcProvider,Wallet,Contract,ContractFactory,id,keccak256,toUtf8Bytes} from 'ethers';
import {USDC,startStreamService,openStream,closeStream,sessionMessage,isGuardedStream} from '../../demo/agent/streams.mjs';
import {PERMIT_TYPES,domain,metadataHash} from '../../demo/policy/permit.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('guarded CLI adapter rejects missing approval before signing, reuses authenticated escrow and reconciles signed closure', {timeout:60000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'agentpay-guarded-'));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const configFile=path.join(dir,'hardhat.cjs');
 await writeFile(configFile,`require(${JSON.stringify(path.join(root,'node_modules/@nomicfoundation/hardhat-toolbox'))});module.exports={solidity:'0.8.20',networks:{hardhat:{chainId:11155111,allowBlocksWithSameTimestamp:true,mining:{auto:true,interval:100}}},paths:{artifacts:${JSON.stringify(path.join(root,'artifacts'))},cache:${JSON.stringify(path.join(dir,'cache'))}}};`);
 const child=spawn(process.execPath,[path.join(root,'node_modules/hardhat/internal/cli/cli.js'),'--config',configFile,'node','--hostname','127.0.0.1','--port',String(port)],{cwd:root,stdio:'ignore'});
 const provider=new JsonRpcProvider(`http://127.0.0.1:${port}`,undefined,{cacheTimeout:-1,batchMaxCount:1});let service;
 try{
  for(let n=0;;n++){try{await provider.getNetwork();break;}catch(e){if(n>200||child.exitCode!==null)throw e;await new Promise(r=>setTimeout(r,50));}}
  const artifact=name=>JSON.parse(readFileSync(path.join(root,`artifacts/contracts/${name}.sol/${name.split('/').at(-1)}.json`),'utf8'));
  const usdcArtifact=artifact('test/DemoUSDC');await provider.send('hardhat_setCode',[USDC,usdcArtifact.deployedBytecode]);
  // Public fixture key; never used against a public chain.
  const wallet=new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',provider);
  const signer=await provider.getSigner(0),recipient=await(await provider.getSigner(1)).getAddress(),policy=await provider.getSigner(2),owner=await(await provider.getSigner(3)).getAddress();
  const token=new Contract(USDC,usdcArtifact.abi,signer);await(await token.mint(wallet.address,1000000)).wait(2);
  const a=artifact('AgentPayGuardedStream');const deployed=await new ContractFactory(a.abi,a.bytecode,signer).deploy(USDC,wallet.address,await policy.getAddress(),owner);await deployed.waitForDeployment();const address=await deployed.getAddress();
  assert.equal(await isGuardedStream(provider,address),true);
  service=await startStreamService({provider,agent:wallet.address,recipient,streamAddress:address,sessionId:id('guarded test session')});
  const {quote:q}=await(await fetch(service.url+'/research/basic')).json();
  await provider.send('evm_increaseTime',[1]);await provider.send('evm_mine',[]);
  const config={...JSON.parse(readFileSync(path.join(root,'cre/payment-guard/config.stream.json'),'utf8')),agent:wallet.address,recipient,streamAddress:address,quoteId:q.id,sessionId:q.sessionId};
  const options={provider,wallet,quote:q,decision:{action:'OPEN',config},config,elapsed:()=>1,persist:async()=>{}};
  const nonce=await provider.getTransactionCount(wallet.address);
  await assert.rejects(()=>openStream(options),e=>e.code==='POLICY_SIGNATURE_REQUIRED');
  assert.equal(await provider.getTransactionCount(wallet.address),nonce);
  const permit=async(action,streamId='0')=>{
   const p={action,agent:wallet.address,recipient,amount:q.amountRaw,duration:q.durationSeconds,metadataHash:metadataHash(config),sessionId:q.sessionId,streamId,nonce:(await deployed.nextNonce()).toString(),deadline:(await provider.getBlock('latest')).timestamp+300,decisionHash:keccak256(toUtf8Bytes('fixture policy approval, not a CRE execution'))};
   return {permit:p,signature:await policy.signTypedData(domain(11155111,address),PERMIT_TYPES,p)};
  };
  const funded=await openStream({...options,authorizePolicy:()=>permit(1)});
  const signature=await wallet.signMessage(sessionMessage(service.url,q,funded.streamId));
  const before=await provider.getTransactionCount(wallet.address);
  for(let n=0;n<5;n++)assert.equal((await fetch(service.url+'/research/basic',{headers:{'x-agentpay-stream-id':funded.streamId,'x-agentpay-session-signature':signature}})).status,200);
  assert.equal(await provider.getTransactionCount(wallet.address),before);
  await assert.rejects(()=>closeStream({provider,wallet,streamAddress:address,streamId:funded.streamId,persist:async()=>{}}),e=>e.code==='POLICY_SIGNATURE_REQUIRED');
  assert.equal(await provider.getTransactionCount(wallet.address),before);
  const settled=await closeStream({provider,wallet,streamAddress:address,streamId:funded.streamId,persist:async()=>{},policyApproval:await permit(2,funded.streamId)});
  assert.equal(settled.closed,true);assert.equal(BigInt(settled.earnedRaw)+BigInt(settled.refundedRaw),10000n);
  assert.equal(await deployed.nextNonce(),2n);
 }finally{if(service)await service.close();provider.destroy();child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
