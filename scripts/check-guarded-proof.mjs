import {readFile} from 'node:fs/promises';
import {verifyGuardedProof} from './lib/guarded-proof.mjs';
const root=new URL('../',import.meta.url);
const load=async f=>JSON.parse(await readFile(new URL(f,root),'utf8'));
verifyGuardedProof({
 deployment:await load('docs/deployment/guarded-usdc-stream.json'),
 rpc:await load('docs/evidence/guarded-stream/rpc-verification.json'),
 permits:{open:await load('docs/evidence/guarded-stream/policy-open.json'),close:await load('docs/evidence/guarded-stream/policy-close.json')},
 evidence:{open:await load('docs/evidence/guarded-stream/open-evidence.json'),close:await load('docs/evidence/guarded-stream/close-evidence.json')},
});
console.log('Verified saved guarded permit signatures, evidence commitments, exact intent, consumed-nonce record and payout accounting. Historical evidence only; no live RPC or CRE.');
const hashes=await load('docs/evidence/guarded-retest/hashes.json');
const {createHash}=await import('node:crypto');
for(const [file,hash] of Object.entries(hashes)) {
 if(!/^[a-zA-Z0-9_.-]+$/.test(file))throw Error('Invalid retest artifact path');
 const text=await readFile(new URL(`docs/evidence/guarded-retest/${file}`,root));
 if(createHash('sha256').update(text).digest('hex')!==hash)throw Error(`Retest evidence drift: ${file}`);
}
const retest=await load('docs/evidence/guarded-retest/retest-verification.json');
const failure=await load('docs/evidence/guarded-retest/failure-summary.json');
const recovery=await load('docs/evidence/guarded-retest/recovery.json');
const approval=await load('docs/evidence/guarded-retest/policy-open.json');
const deployment=await load('docs/deployment/guarded-usdc-stream.json');
const {verifyTypedData}=await import('ethers');
const {domain,PERMIT_TYPES}=await import('../demo/policy/permit.mjs');
if(verifyTypedData(domain(11155111,deployment.address),PERMIT_TYPES,approval.permit,approval.signature)!==deployment.policySigner)throw Error('Retest signature mismatch');
if(retest.fullDemoPassed!==false||retest.successfulRequests!==5||failure.streamId!=='2'||recovery.closed!==true||recovery.streamId!=='2')throw Error('Retest outcome mismatch');
if(BigInt(recovery.earnedRaw)+BigInt(recovery.refundedRaw)!==10000n||retest.recipientDeltaRaw!==recovery.earnedRaw||retest.operatorRecovery.transactionHash!==recovery.transactionHash)throw Error('Recovery accounting mismatch');
console.log('Verified saved failed-retest hashes, OPEN signature, incomplete status and separately recorded operator recovery. No fresh RPC check.');
