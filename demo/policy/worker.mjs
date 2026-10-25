import {readFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Wallet,Contract,JsonRpcProvider,keccak256,toUtf8Bytes} from 'ethers';
import {runCreIntent,runStreamCheck} from '../agent/cre.mjs';
import {assertLocalApproval,USDC} from '../agent/payments.mjs';
import {validatePolicy,loadProfile} from '../agent/profile.mjs';
import {PERMIT_TYPES,domain,metadataHash} from './permit.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const same=(a,b)=>a?.toLowerCase()===b?.toLowerCase();
let context;
const prices=new Map(),decisions=new Map();
export function checkPolicyBounds(config,policy,kind,agent,recipient,streamAddress){
  const request=kind==='price'?config.request:config;
  if(!same(request.agent,agent)||!same(request.recipient,recipient)||!same(request.token,USDC))throw Error('Policy party or asset mismatch');
  if(kind==='price'){
    if(config.publishReport || config.receiverAddress!=='0x0000000000000000000000000000000000000000')throw Error('Read-only price check required');
    for(const k of ['maxFeedAgeSeconds','maxPegDeviationBps','maxDeviationBps'])if(config[k]!==policy[k])throw Error('Price policy mismatch');
    if(config.request.spendingCap!==policy.depositCapRaw)throw Error('Deposit policy mismatch');
  }else{
    if(!same(config.streamAddress,streamAddress)||config.spendingCapRaw!==policy.depositCapRaw||config.maxRateRawPerSecond!==policy.maxRateRawPerSecond||config.maxFailedRequests!==policy.maxFailedRequests)throw Error('Stream policy mismatch');
    if(config.durationSeconds!==1000)throw Error('Fixed session duration required');
  }
}
async function handle(operation,params){
  if(operation==='init'){
    if(context)throw Error('Policy process already initialized');
    const deployment=JSON.parse(await readFile(path.join(root,'docs/deployment/guarded-usdc-stream.json'),'utf8'));
    if(!same(params.streamAddress,deployment.address))throw Error('Unregistered guarded stream');
    const reference=await loadProfile();
    const policy=validatePolicy(params.policy);
    for(const k of Object.keys(policy))if(Number(policy[k])>Number(reference.policy[k]))throw Error('Policy cannot exceed registered limits');
    const provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com',undefined,{cacheTimeout:-1,batchMaxCount:1});
    if((await provider.getNetwork()).chainId!==11155111n)throw Error('Sepolia required');
    const contract=new Contract(deployment.address,['function agent() view returns(address)','function policySigner() view returns(address)','function nextNonce() view returns(uint256)','function recoveryOwner() view returns(address)'],provider);
    if(keccak256(await provider.getCode(deployment.address))!==deployment.runtimeCodeHash)throw Error('Guarded runtime mismatch');
    const keyFile=path.join(root,'.local/policy/policy-key.json');
    if(((await stat(keyFile)).mode & 0o077)!==0)throw Error('Policy key must be private to the operator (0600)');
    const key=JSON.parse(await readFile(keyFile,'utf8'));
    const signer=new Wallet(key.privateKey);
    if(!same(signer.address,await contract.policySigner())||same(signer.address,await contract.agent())||same(signer.address,await contract.recoveryOwner()))throw Error('Separate registered policy signer required');
    // Directory is host-selected output only; no agent-supplied key path or signing payload.
    if (!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(params.serviceOrigin)) throw Error('Trusted local service origin required');
    const directory=path.resolve(params.directory,'policy');
    if(!directory.startsWith(path.join(root,'.local/agent-demo/runs')+path.sep))throw Error('Invalid policy output directory');
    await mkdir(directory,{recursive:true});
    context={provider,contract,signer,policy,directory,streamAddress:deployment.address,agent:await contract.agent(),recipient:deployment.recipient,serviceOrigin:params.serviceOrigin};
    return {policySigner:signer.address,recoveryOwner:await contract.recoveryOwner()};
  }
  if(!context)throw Error('Initialize policy process first');
  const c=context;
  if(operation==='price'||operation==='stream'){
    const {config}=params;
    if(!/^[a-z0-9-]{1,40}$/.test(params.label))throw Error('Invalid check label');
    checkPolicyBounds(config,c.policy,operation,c.agent,c.recipient,c.streamAddress);
    if(operation==='stream' && !config.healthUrl.startsWith(c.serviceOrigin+'/health/'))throw Error('Unregistered health service');
    const evidence=operation==='price'
      ?await runCreIntent({config,root,directory:c.directory,tier:params.label,onStart:value=>process.send?.({event:'invocation',value})})
      :await runStreamCheck({config,root,directory:c.directory,label:params.label,onStart:value=>process.send?.({event:'invocation',value})});
    const checked={evidence,completed:performance.now()};
    if(operation==='price')prices.set(config.request.requestId,checked);
    else decisions.set(config.requestId,checked);
    return evidence;
  }
  if(operation==='permit'){
    const checked=decisions.get(params.requestId);
    if(!checked||performance.now()-checked.completed>=120000)throw Error('Fresh signer-owned CRE decision required');
    const {config,result}=checked.evidence;
    if(!['OPEN','CLOSE'].includes(result.action))throw Error('Policy result cannot authorize this action');
    if(result.action==='OPEN'){
      if(BigInt(config.amountRaw)>10000n)throw Error('Onchain demo deposit cap exceeded');
      const price=prices.get(config.quoteId);
      if(!price)throw Error('Signer-owned price approval required');
      assertLocalApproval(price.evidence,price.evidence.config,{elapsedMs:performance.now()-price.completed});
    }
    const block=await c.provider.getBlock('latest');
    const permit={action:result.action==='OPEN'?1:2,agent:c.agent,recipient:c.recipient,amount:config.amountRaw,duration:config.durationSeconds,metadataHash:metadataHash(config),sessionId:config.sessionId,streamId:config.streamId,nonce:(await c.contract.nextNonce()).toString(),deadline:block.timestamp+300,decisionHash:keccak256(toUtf8Bytes(JSON.stringify(checked.evidence)))};
    const signature=await c.signer.signTypedData(domain(11155111,c.streamAddress),PERMIT_TYPES,permit);
    return {permit,signature,policySigner:c.signer.address,trust:'local-policy-signature',decision:result.action};
  }
  throw Error('Unsupported policy operation');
}
// Queue requests: nonce/decision issuance cannot race through this process.
let queue=Promise.resolve();
process.on('message',m=>{queue=queue.then(async()=>{
  try{const value=await handle(m.operation,m.params);process.send?.({id:m.id,value});}
  catch(error){process.send?.({id:m.id,error:{code:'POLICY_SIGNER',message:String(error.message).replace(/0x[0-9a-fA-F]{64}/g,'[hash]')}});}
});});
process.on('disconnect',()=>{context?.provider.destroy();process.exit(0);});
