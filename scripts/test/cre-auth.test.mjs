import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,readdir,rm} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import cli from "../lib/cli.cjs";
import {creAuthFailure,runCreProcess} from "../../demo/agent/cre-process.mjs";
import {serializePolicyError,restorePolicyError} from "../../demo/policy/errors.mjs";
import {createAgentOutput} from "../../demo/agent/output.mjs";
const orgFailure="Initializing...\n\n✗ Credential validation failed\n✗ authentication required: credential validation failed: authentication failed: unable to retrieve organization info. Your account may not be fully set up yet — please try again in a few minutes\n";

async function fixture(outputs,action) {
  const root=await mkdtemp(path.join(os.tmpdir(),"cre-auth-"));
  const calls=[],progress=[],waits=[];
  const options={root,logFile:path.join(root,"stream-open.log"),args:["workflow","simulate","payment-guard","--config","same.json"],options:{quiet:true},
    onProgress:line=>progress.push(line),wait:async ms=>waits.push(ms),
    run:async (binary,args)=>{calls.push({binary,args:[...args]});return outputs[Math.min(calls.length-1,outputs.length-1)];}};
  try {await action({root,calls,progress,waits,options});}
  finally {await rm(root,{recursive:true,force:true});}
}
test("pre-execution organization lookup retries once with identical inputs and keeps both logs",async()=>{
  await fixture([{code:1,output:orgFailure},{code:0,output:'Workflow Simulation Result:\n"DENY"'}],async f=>{
    const result=await runCreProcess(f.options);
    assert.equal(result.code,0);assert.equal(f.calls.length,2);
    assert.deepEqual(f.calls[0],f.calls[1]);
    assert.deepEqual(f.waits,[750]);assert.equal(f.progress.length,1);
    assert.equal(await readFile(path.join(f.root,"stream-open.attempt-1.log"),"utf8"),orgFailure);
    assert.equal(await readFile(f.options.logFile,"utf8"),result.log);
  });
});
test("persistent organization failure remains unauthorized and gives account recovery instructions",async()=>{
  await fixture([{code:1,output:orgFailure}],async f=>{
    await assert.rejects(runCreProcess(f.options),error=>{
      assert.ok(error instanceof cli.CliError);assert.equal(error.code,"CRE_ACCOUNT_UNAVAILABLE");
      assert.match(error.message,/cre whoami/);assert.match(error.message,/cre login/);
      assert.match(error.message,/Transcript: stream-open.log/);return true;
    });
    assert.equal(f.calls.length,2);
    assert.ok((await readdir(f.root)).includes("stream-open.attempt-2.log"));
  });
});
test("expired credentials, execution errors and workflow results never trigger an auth retry",async()=>{
  for(const [code,output,expected] of [
    [1,"you are not logged in, try running cre login","CRE_AUTH_REQUIRED"],
    [1,"Compiling workflow...\n"+orgFailure,"CRE_FAILED"],
    [1,"[USER LOG] "+orgFailure,"CRE_FAILED"],
    [1,'Workflow Simulation Result:\n"ALLOW"\n'+orgFailure,"CRE_FAILED"],
    [1,"RPC timeout","CRE_FAILED"],
    [0,'Workflow Simulation Result:\n"DENY"',null],
  ]) await fixture([{code,output}],async f=>{
    if(expected)await assert.rejects(runCreProcess(f.options),{code:expected});
    else assert.equal((await runCreProcess(f.options)).output,output);
    assert.equal(f.calls.length,1);
  });
  assert.equal(creAuthFailure(orgFailure),"CRE_ACCOUNT_UNAVAILABLE");
});
test("diagnostic write failures stop before any retry",async()=>{
  await fixture([{code:1,output:orgFailure}],async f=>{
    f.options.logFile=path.join(f.root,"missing","stream-open.log");
    await assert.rejects(runCreProcess(f.options),{code:"ENOENT"});
    assert.equal(f.calls.length,1);assert.equal(f.waits.length,0);
  });
});
test("authentication retry stays inside the original subprocess time budget",async()=>{
  await fixture([{code:1,output:orgFailure}],async f=>{
    let elapsed=0;
    f.options.now=()=>elapsed;
    f.options.options.timeoutMs=180000;
    f.options.run=async()=>{f.calls.push({});elapsed=179500;return {code:1,output:orgFailure};};
    await assert.rejects(runCreProcess(f.options),{code:"CRE_ACCOUNT_UNAVAILABLE"});
    assert.equal(f.calls.length,1);assert.equal(f.waits.length,0);
  });
  await fixture([{code:1,output:orgFailure}],async f=>{
    let elapsed=0;
    f.options.now=()=>elapsed;
    f.options.wait=async()=>{elapsed=180001;};
    await assert.rejects(runCreProcess(f.options),{code:"TIMEOUT"});
    assert.equal(f.calls.length,1,"No new process starts after the retry budget expires");
  });
});
test("typed CRE failures survive the policy process boundary and keep CLI exit codes",()=>{
  const error=new cli.CliError("CRE_ACCOUNT_UNAVAILABLE","Run cre whoami. Transcript: policy/stream-open.log");
  const restored=restorePolicyError(JSON.parse(JSON.stringify(serializePolicyError(error))));
  assert.ok(restored instanceof cli.CliError);assert.equal(restored.code,error.code);
  assert.equal(restored.message,error.message);assert.equal(restored.exitCode,1);
  const generic=restorePolicyError(serializePolicyError(new Error("Policy check failed")));
  assert.equal(generic.code,"POLICY_SIGNER");assert.equal(generic instanceof cli.CliError,false);
});
test("spend-review command strings render in normal and verbose modes",()=>{
  const command="cre workflow simulate payment-guard --target spend-settings --config config.json";
  for(const verbose of [false,true]){
    const lines=[];
    createAgentOutput({verbose,write:line=>lines.push(line)}).spendReview({phase:"start",invocation:{command,cwd:"cre",configPath:"config.json",transcriptPath:"review.log"}});
    const text=lines.join("\n").replace(/\s+/g," ");
    assert.match(text,/payment-guard/);assert.match(text,/spend-settings/);
    if(verbose)assert.match(text,/--config config.json/);
  }
});
