import {Contract} from "ethers";
import cli from "../../scripts/lib/cli.cjs";
import {USDC,TOKEN_ABI} from "./payments.mjs";

// Snapshot all confirmed wallet fields at one canonical block. A load-balanced
// RPC must not move us behind a block containing an already verified transaction.
export async function readWalletSnapshot(provider,agent,recipient,{minimumBlock=0}={}) {
  if(!Number.isSafeInteger(minimumBlock)||minimumBlock<0)throw new Error("Invalid wallet snapshot block floor");
  const head=await provider.getBlock("latest");
  const block=head && head.number>=minimumBlock ? head : minimumBlock>0 ? await provider.getBlock(minimumBlock) : null;
  if(!block || block.number<minimumBlock || !/^0x[0-9a-fA-F]{64}$/.test(block.hash||""))throw new cli.CliError("WALLET_SNAPSHOT_UNAVAILABLE","RPC has not served the required confirmed wallet block.");
  const token=new Contract(USDC,TOKEN_ABI,provider),options={blockTag:block.number};
  const [payer,payee,nonce]=await Promise.all([
    token.balanceOf(agent,options),token.balanceOf(recipient,options),provider.getTransactionCount(agent,block.number),
  ]);
  if((await provider.getBlock(block.number))?.hash!==block.hash)
    throw new cli.CliError("WALLET_SNAPSHOT_BLOCK_CHANGED","Wallet snapshot block changed; verification stopped.");
  return {blockNumber:block.number,blockHash:block.hash,
    snapshot:{agentBalanceRaw:payer.toString(),recipientBalanceRaw:payee.toString(),nonce}};
}
