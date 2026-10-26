import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyGuardedProof} from '../lib/guarded-proof.mjs';
const read=f=>JSON.parse(readFileSync(new URL('../../'+f,import.meta.url),'utf8'));
const original={deployment:read('docs/deployment/guarded-usdc-stream.json'),rpc:read('docs/evidence/guarded-stream/rpc-verification.json'),permits:{},evidence:{}};
for(const kind of ['open','close']){
 original.permits[kind]=read(`docs/evidence/guarded-stream/policy-${kind}.json`);
 original.evidence[kind]=read(`docs/evidence/guarded-stream/${kind}-evidence.json`);
}
test('current documentation proof validates and rejects changed signatures, result, nonce, destination or payout',()=>{
 assert.doesNotThrow(()=>verifyGuardedProof(original));
 for(const mutate of [
  x=>{x.permits.open.permit.amount='9999';},
  x=>{x.permits.close.permit.nonce='0';},
  x=>{x.evidence.close.result.action='CONTINUE';},
  x=>{x.deployment.address=x.deployment.agent;},
  x=>{x.rpc.refundedRaw='8681';},
  x=>{x.rpc.receipts[0].policyNonce='7';},
  x=>{x.deployment.policySigner=x.deployment.agent;},
 ]){const bad=structuredClone(original);mutate(bad);assert.throws(()=>verifyGuardedProof(bad));}
});
