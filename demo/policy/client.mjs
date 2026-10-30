import {fork} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {restorePolicyError} from './errors.mjs';
// The model/agent never receives a policy key. Only this trusted host starts the
// separate policy process; callers receive evidence and narrowly scoped permits.
export async function startPolicyClient({root,directory,policy,streamAddress,serviceOrigin,onInvocation = () => {},onProgress = () => {}}) {
  const env={};
  for(const key of ['PATH','HOME','CRE_BIN','SEPOLIA_RPC_URL','XDG_CONFIG_HOME','XDG_CACHE_HOME'])
    if(process.env[key])env[key]=process.env[key];
  const child=fork(fileURLToPath(new URL('./worker.mjs',import.meta.url)),[],{
    cwd:root,env,stdio:['ignore','ignore','pipe','ipc'],
  });
  // Raw child errors can contain paths; never forward secrets or model credentials.
  child.stderr.resume();
  let next=0;
  const pending=new Map();
  child.on('message',m=>{
    if(m.event==='invocation'){onInvocation(m.value);return;}
    if(m.event==='progress'){onProgress(m.value);return;}
    const p=pending.get(m.id);if(!p)return;
    clearTimeout(p.timer);pending.delete(m.id);
    if(m.error)p.reject(restorePolicyError(m.error));else p.resolve(m.value);
  });
  const fail=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Policy signer process stopped; no approval available.'));}pending.clear();};
  child.on('exit',fail);child.on('error',fail);
  const request=(operation,params={})=>new Promise((resolve,reject)=>{
    if(!child.connected)return reject(new Error('Policy signer unavailable.'));
    const id=++next;
    const timer=setTimeout(()=>{pending.delete(id);child.kill();reject(new Error('Policy signer timed out; action remains unauthorized.'));},240000);
    pending.set(id,{resolve,reject,timer});child.send({id,operation,params});
  });
  try {await request('init',{directory:path.resolve(directory),policy,streamAddress,serviceOrigin});}
  catch(error){child.kill();throw error;}
  return {
    price:params=>request('price',params),stream:params=>request('stream',params),
    permit:requestId=>request('permit',{requestId}),
    close:()=>{child.kill();fail();},
  };
}
