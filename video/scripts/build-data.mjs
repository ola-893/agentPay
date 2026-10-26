import {readFileSync as read,writeFileSync as write} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {formatUnits,verifyTypedData,keccak256,toUtf8Bytes} from 'ethers';
import {PERMIT_TYPES,domain} from '../../demo/policy/permit.mjs';
import {validateRun} from '../../vite-project/src/lib/run-events.mjs';
const run='vite-project/public/runs/20261025T173241Z-38db9e1a';
const raw=read(`${run}/events.ndjson`,'utf8'), events=validateRun(raw.trim().split('\n').map(JSON.parse));
const first=(type,p=()=>true)=>events.find(e=>e.type===type&&p(e.data));
const all=type=>events.filter(e=>e.type===type);
const price=first('cre.result',d=>d.target==='price').data.observations;
const open=first('cre.result',d=>d.decision==='OPEN').data.observations;
const healthy=first('cre.result',d=>d.decision==='CONTINUE').data.observations;
const outage=first('cre.result',d=>d.decision==='CLOSE').data.observations;
const deny=first('cre.result',d=>d.decision==='DENY').data.observations;
const end=first('run.end').data, profile=events[0].data.profile;
const money=n=>formatUnits(n,6).replace(/\.0$/,'');
const snippet=(file,needle,before,after)=>{const lines=read(file,'utf8').split('\n');const at=lines.findIndex(l=>l.includes(needle));if(at<0)throw Error(needle);const start=Math.max(0,at-before);const code=lines.slice(start,at+after+1);if(code.length>12)throw Error('snippet too long');return {file,line:start+1,code:code.join('\n'),highlight:at-start};};
const logPath=`${run}/artifacts/02-cre-price.log`, log=read(logPath,'utf8').split('\n');
const pickLog=needle=>{const l=log.find(l=>l.includes(needle));if(!l)throw Error(needle);return l;};
const rpc=JSON.parse(read('docs/evidence/guarded-stream/rpc-verification.json'));
for(const k of ['earnedRaw','refundedRaw'])if(rpc[k]!==end[k])throw Error(`RPC mismatch ${k}`);
if(BigInt(end.earnedRaw)+BigInt(end.refundedRaw)!==BigInt(end.fundedRaw))throw Error('split');
assert.equal(events[0].data.contractPolicySignatures,true);
const manifest=JSON.parse(read('vite-project/public/runs/index.json','utf8')).runs.find(r=>r.id===events[0].runId);
assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.sha256);
const deployment=JSON.parse(read('docs/deployment/guarded-usdc-stream.json'));
assert.equal(profile.escrow.toLowerCase(),deployment.address.toLowerCase());
assert.equal(BigInt(rpc.recipientAfterRaw)-BigInt(rpc.recipientBeforeRaw),BigInt(end.earnedRaw));
const permits={};
for(const kind of ['open','close']){
 const approval=JSON.parse(read(`docs/evidence/guarded-stream/policy-${kind}.json`));
 const evidence=JSON.parse(read(`docs/evidence/guarded-stream/${kind}-evidence.json`));
 assert.equal(verifyTypedData(domain(11155111,deployment.address),PERMIT_TYPES,approval.permit,approval.signature),deployment.policySigner);
 assert.equal(keccak256(toUtf8Bytes(JSON.stringify(evidence))),approval.permit.decisionHash);
 const receipt=rpc.receipts.find(r=>r.kind===kind);
 assert.equal(receipt.decisionHash,approval.permit.decisionHash);
 assert.equal(receipt.policyNonce,String(approval.permit.nonce));
 assert.ok(end.transactions.some(t=>t.kind===kind&&t.hash===receipt.transactionHash));
 permits[kind]=approval;
}
const data={source:{run,sha256:createHash('sha256').update(raw).digest('hex'),runId:events[0].runId,log:logPath,rpc:'docs/evidence/guarded-stream/rpc-verification.json'},deployment,permits,profile,price,open,healthy,outage,deny,end,rpc,
 display:{funded:money(end.fundedRaw),earned:money(end.earnedRaw),refund:money(end.refundedRaw),cap:money(profile.policy.depositCapRaw),premium:money(profile.quote.premiumAmountRaw),rate:money(healthy.onchain.stream.flowRate),maxRate:money(profile.policy.maxRateRawPerSecond),calls:Math.max(...all('api.reuse').map(e=>e.data.successfulRequests)),failures:outage.health.failedRequests,feedAge:price.observedAt-price.feedUpdatedAt,feedLimit:price.maxFeedAgeSeconds,coinbase:(Number(price.externalPriceUsd8)/1e8).toFixed(8),chainlink:(Number(price.chainlinkPriceUsd8)/1e8).toFixed(8),pegBps:price.maxPegDeviationBps,sourceBps:price.maxDeviationBps,httpStatus:first('fault').data.httpStatus,streamId:first('stream.closed').data.streamId,auditCount:all('audit.receipt').length},
 snippets:{http:snippet('cre/payment-guard/main.ts','const response = requester.sendRequest',1,3),chain:snippet('cre/payment-guard/main.ts','const response = evm.callContract',1,5),decision:snippet('cre/payment-guard/stream-policy.ts','if (BigInt(c.amountRaw)',1,5),signature:snippet('contracts/AgentPayGuardedStream.sol','require(ecrecover',0,1)},
 transcript:[pickLog('Compiling workflow'),pickLog('✓ Workflow compiled'),pickLog('External USDC/USD'),pickLog('Chainlink Sepolia USDC/USD'),pickLog('Payment guard:')],
 // Exact stdout records; display uses wrapped JSON, never rewritten success messages.
 stdout:events.filter(e=>['api.reuse','fault','stream.closed'].includes(e.type)).map(e=>JSON.stringify(e)),
 transactions:end.transactions.map(t=>({...t,url:`https://sepolia.etherscan.io/tx/${t.hash}`}))};
const js=`// Generated from recorded evidence; run npm run video:data.\nexport default ${JSON.stringify(data,null,2)};\n`,asset=JSON.stringify(data,null,2);
if(process.argv.includes('--check')){
 assert.equal(read('video/data.js','utf8'),js,'Video data/source drift: npm run video:data');
 assert.equal(read('video/agentpay-demo/assets/data.json','utf8'),asset,'Video asset data drift');
 console.log('Verified guarded video hash, signed permits, exact source snippets, payout and generated data. No network or media rendering.');
}else{
 write('video/data.js',js);write('video/agentpay-demo/assets/data.json',asset);
 console.log(JSON.stringify({source:data.source,display:data.display},null,2));
}
