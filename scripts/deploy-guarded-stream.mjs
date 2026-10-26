import {readFile,writeFile,mkdir,open,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import {Wallet,JsonRpcProvider,Contract,ContractFactory,keccak256,isAddress,ZeroAddress} from 'ethers';
import cli from './lib/cli.cjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const USDC='0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
async function authority(name){
 const file=path.join(root,'.local/policy',name+'-key.json');
 try { const info=await stat(file); if((info.mode&0o077)!==0)throw Error('Authority key file must have mode 0600'); return new Wallet(JSON.parse(await readFile(file,'utf8')).privateKey); }
 catch(e){if(e.code!=='ENOENT')throw e;}
 const wallet=Wallet.createRandom();const handle=await open(file,'wx',0o600);
 try{await handle.writeFile(JSON.stringify({privateKey:wallet.privateKey})+'\n');await handle.sync();}finally{await handle.close();}
 return wallet;
}
await cli.cliMain('deploy:guarded-stream',{},`Usage: npm run --silent deploy:guarded-stream -- [--json] [--help]
Deploy the separate locally signed policy escrow on Ethereum Sepolia.
Creates independent policy/recovery keys in ignored .local/policy with mode 0600.
Requires compiled contracts, payer key, recipient and Sepolia ETH. Updates the local
stream address and registered profile after verifying the deployment. CRE stays local.
Refuses existing committed/pending deployment records; no overwrite flag. This
checkout is configured for an existing operator, not automatic new-wallet onboarding.
Never exposes authority keys. Exit: 0 verified; 1 failed; 2 configuration.`,async()=>{
 dotenv.config({path:path.join(root,'.env'),quiet:true});
 const provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com',undefined,{batchMaxCount:1,cacheTimeout:-1});
 try{
  if((await provider.getNetwork()).chainId!==11155111n)throw Error('Sepolia required');
  let payer;try{payer=new Wallet(process.env.PRIVATE_KEY_1||process.env.PRIVATE_KEY||'',provider);}catch{throw new cli.CliError('CONFIG','Configure the dedicated payer wallet.',2);}
  const recipient=process.env.AGENTPAY_AGENT_RECIPIENT||process.env.CRE_PAYMENT_RECIPIENT_ADDRESS;
  if(!isAddress(recipient||'')||recipient===ZeroAddress||recipient.toLowerCase()===payer.address.toLowerCase())throw new cli.CliError('CONFIG','Distinct recipient required.',2);
  const token=new Contract(USDC,['function decimals() view returns(uint8)'],provider);
  if(await token.decimals()!==6n)throw Error('Circle six-decimal USDC required');
  const recordFile=path.join(root,'docs/deployment/guarded-usdc-stream.json');
  try {await stat(recordFile);throw new cli.CliError('EXISTING_DEPLOYMENT','A guarded deployment is already recorded; inspect it before any redeployment.',2);} catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(path.join(root,'.local/policy'),{recursive:true,mode:0o700});
  const signer=await authority('policy'),recovery=await authority('recovery');
  if(new Set([payer.address,signer.address,recovery.address].map(a=>a.toLowerCase())).size!==3)throw Error('Three distinct authorities required');
  const artifact=JSON.parse(await readFile(path.join(root,'artifacts/contracts/AgentPayGuardedStream.sol/AgentPayGuardedStream.json'),'utf8'));
  const factory=new ContractFactory(artifact.abi,artifact.bytecode,payer);
  const args=[USDC,payer.address,signer.address,recovery.address];
  const tx=await factory.getDeployTransaction(...args),fees=await provider.getFeeData();
  const estimate=await provider.estimateGas({...tx,from:payer.address});
  const maxFee=estimate*(fees.maxFeePerGas||fees.gasPrice||0n);
  if(maxFee>10000000000000000n)throw Error('Estimated deployment exceeds 0.01 ETH gas cap');
  if(await provider.getBalance(payer.address)<maxFee)throw Error('Insufficient Sepolia deployment gas');
  const pendingFile=path.join(root,'.local/policy/deployment-pending.json');
  try{await stat(pendingFile);throw Error('Prior deployment submitted; inspect deployment-pending.json instead of retrying.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const deployed=await factory.deploy(...args);
  await writeFile(pendingFile,JSON.stringify({transactionHash:deployed.deploymentTransaction().hash,expectedAddress:await deployed.getAddress()})+'\n',{mode:0o600});
  console.log('Guarded deployment submitted: '+deployed.deploymentTransaction().hash);
  const receipt=await deployed.deploymentTransaction().wait(2,180000);
  if(!receipt||receipt.status!==1)throw Error('Deployment confirmation needs inspection');
  const address=await deployed.getAddress(),code=await provider.getCode(address);
  if(code.toLowerCase()!==artifact.deployedBytecode.toLowerCase()||await deployed.agent()!==payer.address||await deployed.policySigner()!==signer.address||await deployed.recoveryOwner()!==recovery.address||await deployed.paymentToken()!==USDC)throw Error('Deployment verification failed');
  const result={schemaVersion:1,chainId:11155111,address,token:USDC,tokenDecimals:6,agent:payer.address,recipient,policySigner:signer.address,recoveryOwner:recovery.address,trust:'local-policy-signature',creWorkflowDeployed:false,transactionHash:receipt.hash,blockNumber:receipt.blockNumber,status:1,runtimeCodeHash:keccak256(code),verifiedAt:new Date().toISOString(),maxDepositRaw:'10000',maxRateRawPerSecond:'100'};
  await writeFile(recordFile,JSON.stringify(result,null,2)+'\n');
  const envFile=path.join(root,'.env');let env=await readFile(envFile,'utf8');
  env=/^AGENTPAY_USDC_STREAM_ADDRESS=.*$/m.test(env)?env.replace(/^AGENTPAY_USDC_STREAM_ADDRESS=.*$/m,`AGENTPAY_USDC_STREAM_ADDRESS=${address}`):env+`\nAGENTPAY_USDC_STREAM_ADDRESS=${address}\n`;
  await writeFile(envFile,env,{mode:0o600});
  const profileFile=path.join(root,'demo/agents/treasury-research.json');const profile=JSON.parse(await readFile(profileFile,'utf8'));profile.escrow=address;
  await writeFile(profileFile,JSON.stringify(profile,null,2)+'\n');
  console.log('Verified guarded escrow: '+address+'; policy/recovery keys remain outside the agent process.');
  return result;
 }finally{provider.destroy();}
});
