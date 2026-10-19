import { expect } from 'chai';
import { Wallet } from 'ethers';
import { AgentPaySDK } from '../src/AgentPaySDK';

describe('payment recipient preflight', () => {
    const token = '0x0000000000000000000000000000000000000013';
    const stream = '0x0000000000000000000000000000000000000014';
    for (const recipient of [undefined, token]) {
        it(`rejects a ${recipient ? 'token-contract' : 'missing'} recipient before signing a stream`, async () => {
            const sdk = new AgentPaySDK({ privateKey: Wallet.createRandom().privateKey, rpcUrl: 'http://127.0.0.1:1' });
            let error: Error | undefined;
            try { await sdk.createStream(stream, token, 100n, 10, {}, recipient); } catch (e) { error = e as Error; }
            expect(error?.message).to.contain('distinct payment recipient');
        });
    }
    it('rejects invalid raw amounts and fractional/zero-rate durations before RPC or approval', async () => {
        const sdk = new AgentPaySDK({ privateKey: Wallet.createRandom().privateKey, rpcUrl: 'http://127.0.0.1:1' });
        for (const [amount, duration] of [[0n, 10], [-1n, 10], [2n ** 256n, 10], [100n, 1.5], [1n, 10], [100n, 0]] as const) {
            let error: Error | undefined;
            try { await sdk.createStream(stream, token, amount, duration, {}, '0x0000000000000000000000000000000000000015'); }
            catch (e) { error = e as Error; }
            expect(error?.message).to.match(/raw tUSD units|whole seconds/);
        }
    });
});
