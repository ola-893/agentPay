import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confirmedReceipt,sendStreamTransaction} from '../../demo/agent/streams.mjs';
import {keccak256} from 'ethers';
test('a lost broadcast response reconciles only the exact confirmed hash without resubmission',async()=>{
  const raw='0x1234',hash=keccak256(raw);let broadcasts=0;
  const receipt={hash,status:1,confirmations:async()=>2,blockNumber:1,gasUsed:10n,fee:20n};
  const records=[];
  const result=await sendStreamTransaction({
    provider:{broadcastTransaction:async()=>{broadcasts++;throw Error('response lost after mining');},getTransactionReceipt:async queried=>{assert.equal(queried,hash);return receipt;}},
    wallet:{populateTransaction:async tx=>({...tx,chainId:11155111n}),signTransaction:async()=>raw},
    transaction:{to:'0x0000000000000000000000000000000000000001'},kind:'close',persist:async(kind,value)=>records.push(value),
  });
  assert.equal(result.receipt,receipt);assert.equal(broadcasts,1);
  assert.deepEqual(records.map(r=>r.state),['submitting','confirmed']);
  for(const bad of [null,{...receipt,status:0},{...receipt,hash:'0xother'},{...receipt,confirmations:async()=>1}])
    assert.equal(await confirmedReceipt({getTransactionReceipt:async()=>bad},hash),null);
  assert.equal(await confirmedReceipt({getTransactionReceipt:async()=>{throw Error('RPC unavailable');}},hash),null);
});
