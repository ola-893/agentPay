import {test} from "node:test";
import assert from "node:assert/strict";
import {AbiCoder} from "ethers";
import {readWalletSnapshot} from "../../demo/agent/wallet-snapshot.mjs";
const agent="0x"+"1".repeat(40),recipient="0x"+"2".repeat(40),hash="0x"+"a".repeat(64);
const encode=value=>AbiCoder.defaultAbiCoder().encode(["uint256"],[value]);
function fixture(head=41){const reads=[];return {reads,
  async getBlock(tag){reads.push(["block",tag]);return {number:tag==="latest"?head:tag,hash};},
  async getTransactionCount(address,tag){reads.push(["nonce",tag]);assert.equal(address,agent);assert.equal(typeof tag,"number");return 114;},
  async call(tx){reads.push(["call",tx.blockTag]);assert.equal(typeof tx.blockTag,"number");return encode(tx.data.toLowerCase().endsWith(agent.slice(2))?39878592:44280);},
};}
test("wallet balances and nonce are read at one block at or above the last confirmed transaction",async()=>{
  const rpc=fixture();
  const result=await readWalletSnapshot(rpc,agent,recipient,{minimumBlock:42});
  assert.equal(result.blockNumber,42);assert.equal(result.blockHash,hash);
  assert.deepEqual(result.snapshot,{agentBalanceRaw:"39878592",recipientBalanceRaw:"44280",nonce:114});
  for(const [kind,tag]of rpc.reads.filter(([kind])=>kind!=="block"))assert.equal(tag,42,kind);
});
test("advancing blocks with unchanged state preserve equality, but real wallet changes remain visible",async()=>{
  const before=await readWalletSnapshot(fixture(42),agent,recipient);
  const after=await readWalletSnapshot(fixture(43),agent,recipient,{minimumBlock:before.blockNumber});
  assert.deepEqual(before.snapshot,after.snapshot);
  const changed=fixture(44);changed.getTransactionCount=async()=>115;
  assert.notDeepEqual((await readWalletSnapshot(changed,agent,recipient,{minimumBlock:43})).snapshot,before.snapshot);
});
test("reorganizations and unavailable snapshots fail instead of inventing a wallet state",async()=>{
  const rpc=fixture(42);let checks=0;
  rpc.getBlock=async tag=>({number:42,hash:checks++===0?hash:"0x"+"b".repeat(64)});
  await assert.rejects(readWalletSnapshot(rpc,agent,recipient),{code:"WALLET_SNAPSHOT_BLOCK_CHANGED"});
  await assert.rejects(readWalletSnapshot({getBlock:async()=>null},agent,recipient),{code:"WALLET_SNAPSHOT_UNAVAILABLE"});
});
