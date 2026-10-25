import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {JsonRpcProvider,Contract,Wallet,id,verifyTypedData,keccak256,toUtf8Bytes} from 'ethers';
import {PERMIT_TYPES,domain} from '../demo/policy/permit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
dotenv.config({path:path.join(root,'.env'),quiet:true});
const deployment=JSON.parse(await readFile(path.join(root,'docs/deployment/guarded-usdc-stream.json'),'utf8'));
const runId=process.argv[2];if(!/^[0-9TZ]+-[a-f0-9]{8}$/.test(runId||''))throw Error('Usage: node scripts/verify-guarded-stream.mjs <completed local run ID>');const dir=path.join(root,'.local/agent-demo/runs',runId);
const result=JSON.parse(await readFile(path.join(dir,'result.json'),'utf8'));
const provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL,undefined,{cacheTimeout:-1,batchMaxCount:1});
try{
 assert.equal(result.contractPolicySignatures,true);assert.equal(result.purchases.basic.status,'stream-completed');assert.equal(result.purchases.premium.status,'denied');
 const a=JSON.parse(await readFile(path.join(root,'artifacts/contracts/AgentPayGuardedStream.sol/AgentPayGuardedStream.json'),'utf8'));
 const stream=new Contract(deployment.address,a.abi,provider);
 const token=new Contract(deployment.token,['function balanceOf(address) view returns(uint256)'],provider);
 const open=JSON.parse(await readFile(path.join(dir,'open.json'),'utf8')),close=JSON.parse(await readFile(path.join(dir,'close.json'),'utf8'));
 const receipts=[];
 for(const [kind,record,action] of [['open',open,1],['close',close,2]]){
  const receipt=await provider.getTransactionReceipt(record.transactionHash),tx=await provider.getTransaction(record.transactionHash);
  assert.equal(receipt.status,1);assert.equal(tx.to.toLowerCase(),deployment.address.toLowerCase());assert.equal(tx.from.toLowerCase(),deployment.agent.toLowerCase());
  const saved=JSON.parse(await readFile(path.join(dir,`policy-${kind}.json`),'utf8'));
  assert.equal(verifyTypedData(domain(11155111,deployment.address),PERMIT_TYPES,saved.permit,saved.signature),deployment.policySigner);
  const evidenceFiles=(await readdir(path.join(dir,'policy'))).filter(f=>f.startsWith('stream-')&&f.endsWith('.json')&&!f.endsWith('.config.json'));
  const evidenceCandidates=await Promise.all(evidenceFiles.map(async f=>JSON.parse(await readFile(path.join(dir,'policy',f),'utf8'))));
  assert.ok(evidenceCandidates.some(e=>keccak256(toUtf8Bytes(JSON.stringify(e)))===saved.permit.decisionHash),'Missing original signer-owned CRE evidence');
  const events=receipt.logs.filter(l=>l.address.toLowerCase()===deployment.address.toLowerCase()).map(l=>stream.interface.parseLog(l));
  const consumed=events.find(e=>e.name==='PolicyApprovalConsumed');assert.equal(Number(consumed.args.action),action);assert.equal(consumed.args.decisionHash,saved.permit.decisionHash);assert.equal(consumed.args.nonce,BigInt(saved.permit.nonce));
  receipts.push({kind,transactionHash:record.transactionHash,blockNumber:receipt.blockNumber,policyNonce:consumed.args.nonce.toString(),decisionHash:consumed.args.decisionHash,signatureVerified:true});
 }
 const state=await stream.streams(result.purchases.basic.streamId);assert.equal(state.isActive,false);assert.equal(await stream.activeStreamId({blockTag:receipts[1].blockNumber}),0n);assert.equal(await stream.nextNonce({blockTag:receipts[1].blockNumber}),BigInt(receipts[1].policyNonce)+1n);
 const earned=BigInt(result.earnedRaw),refunded=BigInt(result.refundedRaw);assert.equal(earned+refunded,10000n);
 const before=await token.balanceOf(deployment.recipient,{blockTag:receipts[1].blockNumber-1}),after=await token.balanceOf(deployment.recipient,{blockTag:receipts[1].blockNumber});assert.equal(after-before,earned);
 const rejected=[];
 async function rejects(name,fn,reason){try{await fn();throw Error('UNEXPECTED_ACCEPT');}catch(e){if(e.message==='UNEXPECTED_ACCEPT')throw e;assert.ok(String(e.reason||e.message).includes(reason),name+': '+String(e.reason||e.message));rejected.push({case:name,reason});}}
 const agent=new Wallet(process.env.PRIVATE_KEY_1||process.env.PRIVATE_KEY,provider),contract=stream.connect(agent);
 await rejects('unsigned funding',()=>contract.createStream.staticCall(deployment.recipient,1000,10000,'hallucinated'),'Policy approval required');
 await rejects('unsigned closure',()=>contract.cancelStream.staticCall(1),'Policy approval required');
 await rejects('agent invokes owner recovery',()=>contract.recoveryClose.staticCall(1),'Only recovery owner');
 const block=await provider.getBlock('latest');const p={action:1,agent:deployment.agent,recipient:deployment.recipient,amount:'10000',duration:1000,metadataHash:id('hallucinated'),sessionId:id('forged-new-session'),streamId:'0',nonce:(await stream.nextNonce()).toString(),deadline:block.timestamp+300,decisionHash:id('fabricated decision')};
 // Use exact metadata hash to reach signature verification rather than an earlier check.
 p.metadataHash=keccak256(toUtf8Bytes('hallucinated'));
 const forged=await agent.signTypedData(domain(11155111,deployment.address),PERMIT_TYPES,p);
 await rejects('agent fabricates policy approval',()=>contract.createStreamWithPermit.staticCall(p,'hallucinated',forged),'Invalid policy signer');
 const evidence={schemaVersion:1,verifiedAt:new Date().toISOString(),runId,address:deployment.address,chainId:11155111,trust:'local-policy-signature',creWorkflowDeployed:false,receipts,rejected,streamId:result.purchases.basic.streamId,closed:true,successfulRequests:result.purchases.basic.client.successfulRequests,earnedRaw:earned.toString(),refundedRaw:refunded.toString(),recipientBeforeRaw:before.toString(),recipientAfterRaw:after.toString(),recipientDeltaRaw:(after-before).toString()};
 await mkdir(path.join(root,'docs/evidence/guarded-stream'),{recursive:true});await writeFile(path.join(root,'docs/evidence/guarded-stream/rpc-verification.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence,null,2));
}finally{provider.destroy();}
