import { Contract, NonceManager, Signer, isAddress, ZeroAddress, type ContractTransactionReceipt } from 'ethers';

export interface GuardedPaymentConfig {
    guardAddress: string;
    settlementAddress: string;
    chainId: number;
}

const GUARD_ABI = ['function canPay(bytes32,address,address,address,uint256) view returns (bool)'];
const SETTLEMENT_ABI = [
    'function guard() view returns (address)',
    'function settle(bytes32 requestId,address recipient,address token,uint256 amount)',
];
const TOKEN_ABI = [
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
];

/** Pays only against an authorization already accepted by the onchain CRE guard.
 * Simulation JSON and frontend evidence are never treated as spend authority.
 */
export class GuardedPaymentClient {
    private readonly transactionSigner: NonceManager;
    constructor(private readonly signer: Signer, private readonly config: GuardedPaymentConfig) {
        this.transactionSigner = new NonceManager(signer);
        for (const address of [config.guardAddress, config.settlementAddress]) {
            if (!isAddress(address) || address === ZeroAddress) throw new Error('Invalid guard or settlement address');
        }
        if (!Number.isSafeInteger(config.chainId) || config.chainId <= 0) throw new Error('Invalid chain ID');
    }

    protected contract(address: string, abi: string[]): Contract {
        return new Contract(address, abi, this.transactionSigner);
    }

    public async pay(requestId: string, recipient: string, token: string, amount: bigint): Promise<ContractTransactionReceipt> {
        if (!/^0x[0-9a-fA-F]{64}$/.test(requestId) || BigInt(requestId) === 0n) throw new Error('Invalid request ID');
        if ([recipient, token].some(a => !isAddress(a) || a === ZeroAddress)) throw new Error('Invalid payment address');
        if (amount <= 0n || amount >= 2n ** 256n) throw new Error('Invalid amount');
        if (!this.signer.provider) throw new Error('A connected signer is required');
        const network = await this.signer.provider.getNetwork();
        if (network.chainId !== BigInt(this.config.chainId)) throw new Error('Wrong payment chain');
        const agent = await this.signer.getAddress();
        const settlement = this.contract(this.config.settlementAddress, SETTLEMENT_ABI);
        if ((await settlement.guard()).toLowerCase() !== this.config.guardAddress.toLowerCase()) throw new Error('Settlement guard mismatch');
        const guard = this.contract(this.config.guardAddress, GUARD_ABI);
        const args = [requestId, agent, recipient, token, amount] as const;
        if (!await guard.canPay(...args)) throw new Error('CRE authorization missing, denied, expired, or already consumed');
        const asset = this.contract(token, TOKEN_ABI);
        if (await asset.allowance(agent, this.config.settlementAddress) < amount) {
            try {
                const approval = await asset.approve(this.config.settlementAddress, amount);
                const receipt = await approval.wait();
                if (!receipt || receipt.status !== 1) throw new Error('Token approval was not confirmed');
            } catch (error) { this.transactionSigner.reset(); throw error; }
        }
        if (!await guard.canPay(...args)) throw new Error('CRE authorization expired before settlement');
        let receipt;
        try {
            const payment = await settlement.settle(requestId, recipient, token, amount);
            receipt = await payment.wait();
        } catch (error) { this.transactionSigner.reset(); throw error; }
        if (!receipt || receipt.status !== 1) throw new Error('Payment was not confirmed');
        return receipt;
    }
}
