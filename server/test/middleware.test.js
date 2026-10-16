const request = require('supertest');
const { expect } = require('chai');
const createApp = require('../index');

describe('x402 Middleware Integration', function () {
    let app;
    let mockContract;

    beforeEach(() => {
        mockContract = {
            streams: async () => ({ recipient: '0x0000000000000000000000000000000000000014', startTime: 0, stopTime: Math.floor(Date.now() / 1000) + 3600, flowRate: 1000000000000000n }),
            isStreamActive: async (id) => {
                if (id === 100n) return true; // Valid stream
                if (id === 99n) return false; // Inactive stream
                throw new Error("RPC Error"); // Simulate network error
            }
        };

        const testConfig = {
            rpcUrl: "http://localhost:8545", // Dummy
            agentPayContractAddress: "0xMock",
            tokenAddress: "0xTestTokenMock",
            recipientAddress: '0x0000000000000000000000000000000000000014',
            mockContract: mockContract, // Inject mock
            routes: {
                '/api/weather': {
                    price: '0.0001',
                    mode: 'streaming'
                },
                '/api/premium': {
                    price: '1.0',
                    mode: 'per-request'
                }
            }
        };

        app = createApp(testConfig);
    });

    describe('Public Routes', function () {
        it('should allow access to public routes without payment', async function () {
            const res = await request(app).get('/api/free');
            expect(res.status).to.equal(200);
            expect(res.body.message).to.equal("This is free content.");
        });
    });

    describe('Protected Routes (No Payment)', function () {
        it('should return 402 for protected route without headers', async function () {
            const res = await request(app).get('/api/weather');
            expect(res.status).to.equal(402);
            expect(res.header['x-payment-required']).to.equal('true');
            expect(res.header['x-agentpay-mode']).to.equal('streaming');
            expect(res.header['x-agentpay-rate']).to.equal('0.0001');
            expect(res.body.requirements).to.exist;
        });

        it('should return 402 for premium route with correct pricing', async function () {
            const res = await request(app).get('/api/premium');
            expect(res.status).to.equal(402);
            expect(res.header['x-agentpay-mode']).to.equal('per-request');
            expect(res.header['x-agentpay-rate']).to.equal('1.0');
        });
    });

    describe('Protected Routes (With Payment)', function () {
        it('rejects an active stream paying another recipient', async function () {
            mockContract.streams = async () => ({ recipient: '0x0000000000000000000000000000000000000015', stopTime: 9999999999, startTime: 0, flowRate: 1000000000000000n });
            const res = await request(app).get('/api/weather').set('X-AgentPay-Stream-ID', '100');
            expect(res.status).to.equal(402);
        });
        it('rejects fabricated transaction hashes instead of accepting their shape', async function () {
            const res = await request(app).get('/api/weather').set('X-AgentPay-Tx-Hash', '0x' + '1'.repeat(64));
            expect(res.status).to.equal(402);
            expect(res.body.error).to.contain('disabled');
        });
        it('should return 200 for valid active stream', async function () {
            const res = await request(app)
                .get('/api/weather')
                .set('X-AgentPay-Stream-ID', '100');

            expect(res.status).to.equal(200);
            expect(res.body.paidWithStream).to.equal('100');
        });

        it('should return 402 for inactive stream', async function () {
            const res = await request(app)
                .get('/api/weather')
                .set('X-AgentPay-Stream-ID', '99');

            // Middleware checks stream, sees false, returns 402 error json
            expect(res.status).to.equal(402);
            expect(res.body.error).to.equal("Stream is inactive");
        });

        it('should fallback to 402/Requirements on system error', async function () {
            const res = await request(app)
                .get('/api/weather')
                .set('X-AgentPay-Stream-ID', '0'); // triggers throw in mock

            // When verification crashes, it should default to sending the payment requirements again
            expect(res.status).to.equal(402);
            expect(res.body.requirements).to.exist;
        });
    });
});
