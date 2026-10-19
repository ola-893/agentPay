const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const {createRequire}=require('node:module');
const sdkRequire=createRequire(path.join(root,'sdk/package.json'));
const {ethers}=sdkRequire('ethers');
const {GuardedPaymentClient}=require(path.join(root,'sdk/dist/GuardedPaymentClient.js'));
async function main(){
 const config=JSON.parse(fs.readFileSync(path.join(root,'cre/payment-guard/config.sepolia.json'),'utf8'));
 const deployment=JSON.parse(fs.readFileSync(path.join(root,'docs/deployment/sepolia-guard.json'),'utf8'));
 const req=new ethers.FetchRequest(process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com');req.timeout=15000;
 const provider=new ethers.JsonRpcProvider(req,undefined,{batchMaxCount:1});
 try{
  if((await provider.getNetwork()).chainId!==11155111n)throw new Error('Wrong chain');
  const wallet=new ethers.Wallet(process.env.PRIVATE_KEY,provider);
  if(wallet.address.toLowerCase()!==config.request.agent.toLowerCase())throw new Error('Payer mismatch');
  const guard=new ethers.Contract(config.receiverAddress,['function workflowId() view returns(bytes32)','function reported(bytes32) view returns(bool)','function consumed(bytes32) view returns(bool)'],provider);
  if(await guard.workflowId()!==ethers.ZeroHash||await guard.reported(config.request.requestId))throw new Error('Expected unconfigured guard for this negative test');
  const token=new ethers.Contract(config.request.token,['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)'],provider);
  const settlement=deployment.contracts.AgentPaySettlement.address;
  const snapshot=async()=>({payerBalanceRaw:(await token.balanceOf(wallet.address)).toString(),recipientBalanceRaw:(await token.balanceOf(config.request.recipient)).toString(),allowanceRaw:(await token.allowance(wallet.address,settlement)).toString(),nonce:await provider.getTransactionCount(wallet.address,'pending')});
  const before=await snapshot();let rejected=false;
  try{await new GuardedPaymentClient(wallet,{guardAddress:config.receiverAddress,settlementAddress:settlement,chainId:11155111}).pay(config.request.requestId,config.request.recipient,config.request.token,BigInt(config.request.amount));}
  catch(error){if(error.message!=='CRE authorization missing, denied, expired, or already consumed')throw error;rejected=true;}
  const after=await snapshot();
  if(!rejected||JSON.stringify(before)!==JSON.stringify(after)||await guard.consumed(config.request.requestId))throw new Error('Fail-closed check failed');
  const evidence={checkedAt:new Date().toISOString(),chainId:11155111,mode:'public-Sepolia-negative-test',guard:config.receiverAddress,settlement,request:config.request,workflowId:ethers.ZeroHash,expectedError:'CRE authorization missing, denied, expired, or already consumed',paymentRejectedBeforeApproval:true,noTransactionSent:true,before,after,positivePaymentTestCompleted:false};
  fs.mkdirSync(path.join(root,'.local/cre'),{recursive:true});
  fs.writeFileSync(path.join(root,'.local/cre/payment-not-authorized.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
 }finally{provider.destroy();}
}
main().catch(e=>{console.error(e.shortMessage||e.message);process.exitCode=1});
