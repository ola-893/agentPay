import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyGuardedProof} from './lib/guarded-proof.mjs';
const root=new URL('../',import.meta.url);
const directory='docs/evidence/readiness-2026-10-29/';
const read=async f=>JSON.parse(await readFile(new URL(f,root),'utf8'));
const manifest=await read(directory+'manifest.json');
for(const [file,hash] of Object.entries(manifest.files)) {
  assert.match(file,/^(?:full|interruption|initial|checks)\/[a-zA-Z0-9_.-]+$/);
  assert.equal(createHash('sha256').update(await readFile(new URL(directory+file,root))).digest('hex'),hash,`Readiness evidence changed: ${file}`);
}
const deployment=await read('docs/deployment/guarded-usdc-stream.json');
for(const journey of ['full','interruption']) {
  const base=directory+journey+'/';
  const rpc=await read(base+'rpc-verification.json');
  const permits={},evidence={};
  for(const kind of ['open','close']) {
    permits[kind]=await read(base+`policy-${kind}.json`);
    evidence[kind]=await read(base+`${kind}-evidence.json`);
  }
  verifyGuardedProof({deployment,rpc,permits,evidence});
  if(journey==='interruption') {
    const process=await read(base+'process.json');
    assert.equal(process.code,130);assert.equal(process.interrupted,true);
    assert.equal(rpc.cliCleanupStatus,'needs-attention');
    assert.equal(rpc.reconciliation,'independent-rpc');
    assert.equal(evidence.close.config.phase,'shutdown');
    assert.equal(evidence.close.result.reason,'CLIENT_SHUTDOWN');
    assert.equal(evidence.close.result.health.serviceAvailable,true);
  } else assert.equal(rpc.successfulRequests,10);
}
console.log('Verified October 29 saved live lifecycle and SIGINT shutdown signatures, evidence hashes, receipt accounting and original timeout outcome. No new RPC or CRE.');
