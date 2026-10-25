import { Interface, keccak256, toUtf8Bytes } from 'ethers';
export const PERMIT_FIELDS = [
  ['action','uint8'], ['agent','address'], ['recipient','address'], ['amount','uint256'],
  ['duration','uint256'], ['metadataHash','bytes32'], ['sessionId','bytes32'],
  ['streamId','uint256'], ['nonce','uint256'], ['deadline','uint64'], ['decisionHash','bytes32'],
].map(([name,type])=>({name,type}));
export const PERMIT_TYPES = {Permit: PERMIT_FIELDS};
export const PERMIT_TUPLE = '('+PERMIT_FIELDS.map(f=>`${f.type} ${f.name}`).join(',')+')';
export const GUARDED_ABI = [
  'function agent() view returns(address)', 'function policySigner() view returns(address)',
  'function recoveryOwner() view returns(address)', 'function nextNonce() view returns(uint256)',
  'function activeStreamId() view returns(uint256)', 'function streamSessions(uint256) view returns(bytes32)',
  `function createStreamWithPermit(${PERMIT_TUPLE} permit,string metadata,bytes signature)`,
  `function cancelStreamWithPermit(${PERMIT_TUPLE} permit,bytes signature)`,
  'function recoveryClose(uint256)',
  'event PolicyApprovalConsumed(uint256 indexed nonce,uint8 action,uint256 indexed streamId,bytes32 decisionHash)',
];
export const guardedInterface = new Interface(GUARDED_ABI);
export const domain = (chainId,verifyingContract)=>({name:'AgentPayGuardedStream',version:'1',chainId,verifyingContract});
export const metadataFor = c=>JSON.stringify({sessionId:c.sessionId,quoteId:c.quoteId});
export const metadataHash = c=>keccak256(toUtf8Bytes(metadataFor(c)));
