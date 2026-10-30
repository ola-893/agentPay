// Read-only reproduction of the original failed run's exact public calldata.
// Requires an archive-capable Sepolia RPC; never signs or broadcasts anything.
import {readFile} from "node:fs/promises";
import {FetchRequest,JsonRpcProvider,toQuantity} from "ethers";
import dotenv from "dotenv";
dotenv.config({quiet:true});
const intent = JSON.parse(await readFile(new URL("original-intent.json", import.meta.url), "utf8"));
const request = new FetchRequest(process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com");
request.timeout = 15000;
const provider = new JsonRpcProvider(request, undefined, {batchMaxCount:1,cacheTimeout:-1});
try {
  if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error("Sepolia required");
  const tx = {from:intent.payer,to:intent.transaction.to,data:intent.transaction.data,value:toQuantity(BigInt(intent.transaction.value))};
  for (const blockNumber of [12020461,12020466,12020470]) {
    const block = await provider.getBlock(blockNumber);
    const record = {checkedAt:new Date().toISOString(),blockNumber,blockHash:block.hash,timestamp:block.timestamp};
    for (const method of ["eth_call","eth_estimateGas"]) {
      try { record[method] = {ok:true,result:await provider.send(method,[tx,toQuantity(blockNumber)])}; }
      catch(error) { record[method] = {ok:false,code:error.code || "RPC_ERROR",rpcCode:error.info?.error?.code ?? null}; }
    }
    console.log(JSON.stringify(record));
  }
} finally {provider.destroy();}
