import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import {Wallet,Contract,JsonRpcProvider,keccak256} from 'ethers';
import cli from './lib/cli.cjs';
const root=fileURLToPath(new URL('../',import.meta.url));
await cli.cliMain('recover:guarded-stream',{'stream-id':'value'},`Usage: npm run --silent recover:guarded-stream -- --stream-id <id> [--json] [--help]
Operator-only recovery using ignored .local/policy/recovery-key.json, never the agent key.
Inspect the stream first. This closes it without a CRE decision and requires Sepolia ETH
on the separate recovery owner. Paid agent runs cannot use this authority.
Exit: 0 verified; 1 failed; 2 usage.`,async({flags})=>{
 if(!/^[1-9][0-9]*$/.test(flags['stream-id']||''))throw new cli.CliError('USAGE','A positive --stream-id is required.',2);
 dotenv.config({path:path.join(root,'.env'),quiet:true});
 const deployment=JSON.parse(await readFile(path.join(root,'docs/deployment/guarded-usdc-stream.json'),'utf8'));
 const provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com',undefined,{cacheTimeout:-1,batchMaxCount:1});
 try{
  if((await provider.getNetwork()).chainId!==11155111n||keccak256(await provider.getCode(deployment.address))!==deployment.runtimeCodeHash)throw Error('Wrong network or guarded runtime');
  const {privateKey}=JSON.parse(await readFile(path.join(root,'.local/policy/recovery-key.json'),'utf8'));
  const owner=new Wallet(privateKey,provider);
  const stream=new Contract(deployment.address,['function recoveryOwner() view returns(address)','function recoveryClose(uint256)','function streams(uint256) view returns(address sender,address recipient,uint256 totalAmount,uint256 flowRate,uint256 startTime,uint256 stopTime,uint256 amountWithdrawn,bool isActive,string metadata)','event StreamCancelled(uint256 indexed streamId,address sender,address recipient,uint256 senderBalance,uint256 recipientBalance)'],owner);
  if(await stream.recoveryOwner()!==owner.address||owner.address===deployment.agent)throw Error('Independent recovery owner required');
  const before=await stream.streams(flags['stream-id']);if(!before.isActive)throw Error('Stream already inactive');
  const gas=await stream.recoveryClose.estimateGas(flags['stream-id']),fee=await provider.getFeeData();
  if(gas*(fee.maxFeePerGas||fee.gasPrice||0n)>10000000000000000n)throw Error('Recovery gas exceeds 0.01 ETH cap');
  const tx=await stream.recoveryClose(flags['stream-id']);console.log('Recovery submitted: '+tx.hash+'; inspect this hash before retrying.');
  const receipt=await tx.wait(2,120000);
  if(receipt?.status!==1||(await stream.streams(flags['stream-id'])).isActive)throw Error('Recovery closure not verified');
  const events=receipt.logs.map(l=>{try{return stream.interface.parseLog(l);}catch{return null;}}).filter(e=>e?.name==='StreamCancelled'&&e.args.streamId===BigInt(flags['stream-id']));
  if(events.length!==1||events[0].args.senderBalance+events[0].args.recipientBalance!==before.totalAmount-before.amountWithdrawn)throw Error('Recovery payout mismatch');
  return {streamId:flags['stream-id'],closed:true,operatorOverride:true,transactionHash:receipt.hash,earnedRaw:events[0].args.recipientBalance.toString(),refundedRaw:events[0].args.senderBalance.toString()};
 }finally{provider.destroy();}
});
