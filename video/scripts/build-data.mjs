import {readFileSync as read,writeFileSync as write} from 'node:fs';
import {createHash} from 'node:crypto';
const run='vite-project/public/runs/20261022T112249Z-556c7ea3';
const raw=read(`${run}/events.ndjson`,'utf8'), events=raw.trim().split('\n').map(JSON.parse);
const first=(type,p=()=>true)=>events.find(e=>e.type===type&&p(e.data));
const all=type=>events.filter(e=>e.type===type);
const price=first('cre.result',d=>d.target==='price').data.observations;
const open=first('cre.result',d=>d.decision==='OPEN').data.observations;
const healthy=first('cre.result',d=>d.decision==='CONTINUE').data.observations;
const outage=first('cre.result',d=>d.decision==='CLOSE').data.observations;
const deny=first('cre.result',d=>d.decision==='DENY').data.observations;
const end=first('run.end').data, profile=events[0].data.profile;
const money=n=>(Number(BigInt(n))/10**price.tokenDecimals).toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
const snippet=(file,needle,before,after)=>{const lines=read(file,'utf8').split('\n');const at=lines.findIndex(l=>l.includes(needle));if(at<0)throw Error(needle);const start=Math.max(0,at-before);const code=lines.slice(start,at+after+1);if(code.length>12)throw Error('snippet too long');return {file,line:start+1,code:code.join('\n'),highlight:at-start};};
const logPath=`${run}/artifacts/02-cre-price.log`, log=read(logPath,'utf8').split('\n');
const pickLog=needle=>{const l=log.find(l=>l.includes(needle));if(!l)throw Error(needle);return l;};
const rpc=JSON.parse(read('docs/evidence/workflow-dashboard/rpc-verification.json'));
for(const k of ['fundedRaw','earnedRaw','refundedRaw'])if(rpc[k]!==end[k])throw Error(`RPC mismatch ${k}`);
if(BigInt(end.earnedRaw)+BigInt(end.refundedRaw)!==BigInt(end.fundedRaw))throw Error('split');
const data={source:{run,sha256:createHash('sha256').update(raw).digest('hex'),runId:events[0].runId,log:logPath,rpc:'docs/evidence/workflow-dashboard/rpc-verification.json'},profile,price,open,healthy,outage,deny,end,rpc,
 display:{funded:money(end.fundedRaw),earned:money(end.earnedRaw),refund:money(end.refundedRaw),cap:money(profile.policy.depositCapRaw),premium:money(profile.quote.premiumAmountRaw),rate:money(healthy.onchain.stream.flowRate),maxRate:money(profile.policy.maxRateRawPerSecond),calls:Math.max(...all('api.reuse').map(e=>e.data.successfulRequests)),failures:outage.health.failedRequests,feedAge:price.observedAt-price.feedUpdatedAt,feedLimit:price.maxFeedAgeSeconds,coinbase:(Number(price.externalPriceUsd8)/1e8).toFixed(8),chainlink:(Number(price.chainlinkPriceUsd8)/1e8).toFixed(8),pegBps:price.maxPegDeviationBps,sourceBps:price.maxDeviationBps,httpStatus:first('fault').data.httpStatus,streamId:first('stream.closed').data.streamId,auditCount:all('audit.receipt').length},
 snippets:{http:snippet('cre/payment-guard/main.ts','const response = requester.sendRequest',1,3),chain:snippet('cre/payment-guard/main.ts','const response = evm.callContract',1,5),decision:snippet('cre/payment-guard/stream-policy.ts','if (BigInt(c.amountRaw)',1,5)},
 transcript:[pickLog('Compiling workflow'),pickLog('✓ Workflow compiled'),pickLog('External USDC/USD'),pickLog('Chainlink Sepolia USDC/USD'),pickLog('Payment guard:')],
 // Exact stdout records; display uses wrapped JSON, never rewritten success messages.
 stdout:events.filter(e=>['api.reuse','fault','stream.closed'].includes(e.type)).map(e=>JSON.stringify(e)),
 transactions:end.transactions.map(t=>({...t,url:`https://sepolia.etherscan.io/tx/${t.hash}`}))};
write('video/data.js',`// Generated from recorded evidence; run npm run video:data.\nexport default ${JSON.stringify(data,null,2)};\n`);
write('video/agentpay-demo/assets/data.json',JSON.stringify(data,null,2));
console.log(JSON.stringify({source:data.source,display:data.display},null,2));
