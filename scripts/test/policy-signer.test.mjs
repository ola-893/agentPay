import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPolicyBounds} from '../../demo/policy/worker.mjs';
import {validatePolicy} from '../../demo/agent/profile.mjs';
import {PERMIT_TYPES,domain} from '../../demo/policy/permit.mjs';
import {Wallet,verifyTypedData,id} from 'ethers';
const agent='0x1111111111111111111111111111111111111111',recipient='0x2222222222222222222222222222222222222222',stream='0x3333333333333333333333333333333333333333',token='0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const policy=validatePolicy({depositCapRaw:'100000',maxRateRawPerSecond:'100',maxPegDeviationBps:100,maxDeviationBps:100,maxFeedAgeSeconds:86400,maxFailedRequests:3});
test('policy signer rejects caller-supplied weaker rules, changed parties and targets',()=>{
 const config={agent,recipient,token,streamAddress:stream,spendingCapRaw:'100000',maxRateRawPerSecond:'100',maxFailedRequests:3,durationSeconds:1000};
 assert.doesNotThrow(()=>checkPolicyBounds(config,policy,'stream',agent,recipient,stream));
 for(const patch of [{spendingCapRaw:'100001'},{maxRateRawPerSecond:'101'},{maxFailedRequests:4},{recipient:agent},{agent:recipient},{streamAddress:agent},{durationSeconds:3600},{token:agent}])assert.throws(()=>checkPolicyBounds({...config,...patch},policy,'stream',agent,recipient,stream));
 const price={request:{agent,recipient,token,spendingCap:'100000'},receiverAddress:'0x0000000000000000000000000000000000000000',publishReport:false,maxFeedAgeSeconds:86400,maxPegDeviationBps:100,maxDeviationBps:100};
 assert.doesNotThrow(()=>checkPolicyBounds(price,policy,'price',agent,recipient,stream));
 for(const patch of [{maxFeedAgeSeconds:86401},{maxPegDeviationBps:101},{maxDeviationBps:101},{publishReport:true},{receiverAddress:agent}])assert.throws(()=>checkPolicyBounds({...price,...patch},policy,'price',agent,recipient,stream));
});
test('local policy typed data binds action, exact intent, nonce, expiry, chain and escrow',async()=>{
 const signer=Wallet.createRandom(),p={action:1,agent,recipient,amount:'10000',duration:1000,metadataHash:id('metadata'),sessionId:id('session'),streamId:'0',nonce:'0',deadline:2000000000,decisionHash:id('CRE observations')};
 const signature=await signer.signTypedData(domain(11155111,stream),PERMIT_TYPES,p);
 assert.equal(verifyTypedData(domain(11155111,stream),PERMIT_TYPES,p,signature),signer.address);
 for(const patch of [{action:2},{recipient:agent},{amount:'10001'},{duration:999},{sessionId:id('other')},{streamId:'1'},{nonce:'1'},{deadline:2000000001},{decisionHash:id('other')}])assert.notEqual(verifyTypedData(domain(11155111,stream),PERMIT_TYPES,{...p,...patch},signature),signer.address);
 assert.notEqual(verifyTypedData(domain(1,stream),PERMIT_TYPES,p,signature),signer.address);
 assert.notEqual(verifyTypedData(domain(11155111,agent),PERMIT_TYPES,p,signature),signer.address);
});
