import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,readdir,rm} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {simulateFixedIntent,observeIntent,startAuditService} from "../../demo/audit/service.mjs";
import {LocalJournal,digest} from "../../demo/audit/journal.mjs";
const block={number:42,hash:"0x"+"a".repeat(64)};
const intent={id:"0x"+"1".repeat(64),payer:"0x"+"2".repeat(40),transaction:{to:"0x"+"3".repeat(40),data:"0x12345678",value:"0"}};
function provider(failures=1){
  const calls=[];
  return {calls,async getBlock(number){assert.equal(number,42);return block;},async send(method,args){
    calls.push({method,args:structuredClone(args)});
    if(method==="eth_call" && failures-->0)throw Object.assign(new Error("Unavailable"),{code:"TIMEOUT"});
    return method==="eth_call"?"0x":"0x10000";
  }};
}
test("initial observation retries use one exact fixed block and unchanged transaction",async()=>{
  const rpc=provider(),attempts=[];
  const observation=await simulateFixedIntent(rpc,intent,block,{wait:async()=>{},onAttempt:async value=>attempts.push(value)});
  assert.equal(observation.status,"success");assert.equal(attempts.length,2);
  for(const call of rpc.calls)assert.deepEqual(call.args,[{from:intent.payer,to:intent.transaction.to,data:intent.transaction.data,value:"0x0"},"0x2a"]);
  assert.equal(attempts[0].failure.operation,"eth_call");assert.equal(attempts[0].failure.providerCode,"TIMEOUT");
});
test("permanent unavailability remains ERROR-capable; reverts and changed blocks are never retried",async()=>{
  const unavailable=provider(Infinity);
  assert.equal((await simulateFixedIntent(unavailable,intent,block,{wait:async()=>{}})).status,"unavailable");
  assert.equal(unavailable.calls.length,3);
  for(const changed of [false,true]){
    const rpc=provider(0);let reads=0;
    if(changed)rpc.getBlock=async()=>{reads++;return {...block,hash:"0x"+"b".repeat(64)};};
    else rpc.send=async()=>{reads++;throw Object.assign(new Error("execution reverted"),{code:"CALL_EXCEPTION"});};
    assert.equal((await simulateFixedIntent(rpc,intent,block,{wait:async()=>{}})).errorCode,changed?"BLOCK_CHANGED":"EVM_REVERT");
    assert.equal(reads,1);
  }
});
test("fixed-block attempts are durable and a failed evidence write prevents retry",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"fixed-simulation-"));
  try{
    const journal=await new LocalJournal(dir).init(),rpc=provider();
    assert.equal((await observeIntent(journal,rpc,intent,block)).status,"success");
    const names=await readdir(path.join(dir,"simulation"));assert.equal(names.length,2);
    const first=JSON.parse(await readFile(path.join(dir,"simulation",names.sort()[0]),"utf8"));
    assert.equal(first.intentHash,digest(intent));assert.equal(first.observation.blockHash,block.hash);
    const failing=provider();
    await assert.rejects(simulateFixedIntent(failing,intent,block,{onAttempt:async()=>{throw Error("disk full");}}),/disk full/);
    assert.equal(failing.calls.length,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("concurrent HTTP requests share one immutable observation and its retries",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"simulation-http-"));let service;
  try{
    const journal=await new LocalJournal(dir).init(),rpc=provider();
    service=await startAuditService({journal,provider:rpc});
    service.register({intent,intentHash:digest(intent),observationBlock:block.number,blockHash:block.hash});
    const request=()=>fetch(service.url+"/simulate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({intentId:intent.id})}).then(async r=>{assert.equal(r.status,200);return r.json();});
    const [a,b]=await Promise.all([request(),request()]);
    assert.deepEqual(a,b);assert.equal(a.status,"success");assert.equal(rpc.calls.length,3);
    assert.equal((await readdir(path.join(dir,"simulation"))).length,2);
    await request();assert.equal(rpc.calls.length,3);
  }finally{await service?.close();await rm(dir,{recursive:true,force:true});}
});
