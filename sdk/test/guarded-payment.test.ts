import { expect } from 'chai';
import { ethers, type Contract, type Signer } from 'ethers';
import { GuardedPaymentClient } from '../src/GuardedPaymentClient';

describe('CRE guarded payment client', () => {
    const guardAddress = '0x0000000000000000000000000000000000000011';
    const settlementAddress = '0x0000000000000000000000000000000000000012';
    const token = '0x0000000000000000000000000000000000000013';
    const recipient = '0x0000000000000000000000000000000000000014';
    const requestId = ethers.id('guarded-payment');
    let approved: boolean, approvals: number, payments: number, chainId: bigint, checks: number, expire: boolean;
    let client: GuardedPaymentClient;
    let authorizedAmount: bigint, approvedAmount: bigint, settledAmount: bigint;
    beforeEach(() => {
        approved = true; approvals = 0; payments = 0; chainId = 11155111n; checks = 0; expire = false;
        const signer = { provider: { getNetwork: async () => ({ chainId }) }, getAddress: async () => recipient } as unknown as Signer;
        class TestClient extends GuardedPaymentClient {
            protected contract(address: string): Contract {
                if (address === guardAddress) return { canPay: async (...args: any[]) => { authorizedAmount = args[4]; checks++; return approved && !(expire && checks > 1); } } as unknown as Contract;
                if (address === settlementAddress) return {
                    guard: async () => guardAddress,
                    settle: async (...args: any[]) => { settledAmount = args[3]; payments++; return { wait: async () => ({ status: 1, hash: ethers.id('tx') }) }; }
                } as unknown as Contract;
                return { allowance: async () => 0n, approve: async (_spender: string, amount: bigint) => { approvedAmount = amount; approvals++; return { wait: async () => ({ status: 1 }) }; } } as unknown as Contract;
            }
        }
        client = new TestClient(signer, { guardAddress, settlementAddress, chainId: 11155111 });
    });
    const pay = () => client.pay(requestId, recipient, token, 10n);
    const failure = async (promise: Promise<unknown>, expected: string) => {
        try { await promise; expect.fail('Expected rejection'); } catch (error: any) { expect(error.message).to.contain(expected); }
    };
    it('checks onchain authority before approval and settles a confirmed payment', async () => {
        const result = await pay();
        expect(result.status).to.equal(1); expect(approvals).to.equal(1); expect(payments).to.equal(1); expect(checks).to.equal(2);
    });
    it('passes 0.01 USDC as exactly 10000 units through authorization, approval and settlement', async () => {
        await client.pay(requestId, recipient, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 10000n);
        expect(authorizedAmount).to.equal(10000n);
        expect(approvedAmount).to.equal(10000n);
        expect(settledAmount).to.equal(10000n);
    });
    it('never approves tokens when CRE authority is absent', async () => {
        approved = false; await failure(pay(), 'authorization missing');
        expect(approvals).to.equal(0); expect(payments).to.equal(0);
    });
    it('stops when authorization expires during token approval', async () => {
        expire = true; await failure(pay(), 'expired before settlement'); expect(payments).to.equal(0);
    });
    it('rejects the wrong chain before creating any transaction', async () => {
        chainId = 1n; await failure(pay(), 'Wrong payment chain'); expect(approvals).to.equal(0);
    });
    it('rejects malformed payment intent', async () => {
        await failure(client.pay('0x123', recipient, token, 1n), 'request ID');
        await failure(client.pay(requestId, ethers.ZeroAddress, token, 1n), 'payment address');
        await failure(client.pay(requestId, recipient, token, 0n), 'amount');
        expect(approvals).to.equal(0);
    });
});
