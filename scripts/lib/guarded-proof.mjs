import assert from 'node:assert/strict';
import {verifyTypedData,keccak256,toUtf8Bytes} from 'ethers';
import {PERMIT_TYPES,domain,metadataHash} from '../../demo/policy/permit.mjs';
export function verifyGuardedProof({deployment,rpc,permits,evidence}) {
  assert.equal(deployment.trust,'local-policy-signature');
  assert.equal(deployment.creWorkflowDeployed,false);
  assert.equal(rpc.address.toLowerCase(),deployment.address.toLowerCase());
  assert.equal(rpc.closed,true);
  assert.equal(BigInt(rpc.earnedRaw)+BigInt(rpc.refundedRaw),10000n);
  assert.equal(BigInt(rpc.recipientAfterRaw)-BigInt(rpc.recipientBeforeRaw),BigInt(rpc.earnedRaw));
  const parties=[deployment.agent,deployment.policySigner,deployment.recoveryOwner].map(a=>a.toLowerCase());
  assert.equal(new Set(parties).size,3);
  for(const [kind,action] of [['open',1],['close',2]]) {
    const approval=permits[kind],source=evidence[kind],p=approval.permit,c=source.config;
    assert.equal(verifyTypedData(domain(deployment.chainId,deployment.address),PERMIT_TYPES,p,approval.signature),deployment.policySigner);
    assert.equal(keccak256(toUtf8Bytes(JSON.stringify(source))),p.decisionHash);
    assert.equal(Number(p.action),action);
    assert.equal(source.result.action,kind==='open'?'OPEN':'CLOSE');
    assert.deepEqual(source.result.config,c);
    assert.equal(p.agent.toLowerCase(),deployment.agent.toLowerCase());
    assert.equal(p.recipient.toLowerCase(),deployment.recipient.toLowerCase());
    assert.equal(c.streamAddress.toLowerCase(),deployment.address.toLowerCase());
    assert.equal(String(p.amount),c.amountRaw);
    assert.equal(Number(p.duration),c.durationSeconds);
    assert.equal(p.sessionId,c.sessionId);
    assert.equal(p.metadataHash,metadataHash(c));
    assert.equal(String(p.streamId),c.streamId);
    assert.equal(Number(p.streamId),kind==='open'?0:Number(rpc.streamId));
    const receipt=rpc.receipts.find(r=>r.kind===kind);
    assert.equal(receipt.decisionHash,p.decisionHash);
    assert.equal(receipt.policyNonce,String(p.nonce));
    assert.equal(receipt.signatureVerified,true);
  }
  assert.equal(BigInt(permits.close.permit.nonce),BigInt(permits.open.permit.nonce)+1n);
}
