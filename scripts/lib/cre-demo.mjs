import { Interface, keccak256 } from 'ethers';

// Official Sepolia simulation forwarder; this is NOT the production forwarder.
// https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts
export const MOCK_FORWARDER = '0x15fC6ae953E024d975e77382eEeC56A9101f9F88';
export const DEMO_ABI = [
  'function simulationOnly() view returns (bool)',
  'function skipWorkflowIdentity() view returns (bool)',
  'function forwarder() view returns (address)',
  'event SimulationReportRecorded(bytes32 indexed requestId,bool approved,uint64 validUntil,bytes32 reportHash)',
];

export function verifyDemoReceipt(receipt, receiver, deployer, result) {
  if (!receipt || receipt.status !== 1) throw new Error('No successful public-chain receipt');
  if (receipt.to?.toLowerCase() !== MOCK_FORWARDER.toLowerCase() || receipt.from?.toLowerCase() !== deployer.toLowerCase()) throw new Error('Unexpected receipt parties');
  const iface = new Interface(DEMO_ABI);
  const match = receipt.logs.filter(log => log.address.toLowerCase() === receiver.toLowerCase()).some(log => {
    try {
      const event = iface.parseLog(log);
      return event?.name === 'SimulationReportRecorded' && event.args.requestId === result.request.requestId
        && event.args.approved === result.approved && event.args.validUntil === BigInt(result.validUntil)
        && event.args.reportHash === keccak256(result.encodedReport);
    } catch { return false; }
  });
  if (!match) throw new Error('Receipt does not prove acceptance of this exact demo report');
  return { simulationOnly: true, workflowIdentityVerified: false, receiptVerified: true,
    transactionHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
    receiver, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
}
