import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import middleware - using require for CommonJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const agentPayMiddleware = require('../server/middleware/agentPayMiddleware');

// Contract addresses on Sepolia
const AGENTPAYSTREAM_ADDRESS = process.env.AGENTPAY_STREAM_ADDRESS || '';
const MOCK_PAYMENT_TOKEN_ADDRESS = process.env.PAYMENT_TOKEN_ADDRESS || '';
// Use a more reliable RPC endpoint
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

/**
 * Demo Provider: "The Gatekeeper"
 * 
 * This is a premium API service that:
 * 1. Requires tUSD payment streams for access
 * 2. Uses x402 protocol to negotiate payments
 * 3. Validates streams on-chain before serving content
 */
const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.json());

// Real blockchain configuration for Sepolia
const config = {
    tokenAddress: MOCK_PAYMENT_TOKEN_ADDRESS,
    agentPayContractAddress: AGENTPAYSTREAM_ADDRESS,
    rpcUrl: SEPOLIA_RPC_URL,
    recipientAddress: process.env.PAYMENT_RECIPIENT_ADDRESS || '',
    routes: {
        '/api/premium': {
            mode: 'streaming',
            price: '0.0001' // 0.0001 tUSD per second
        },
        '/api/ai-insight': {
            mode: 'streaming',
            price: '0.001' // 0.001 tUSD per second (higher tier)
        }
    }
};

console.log("🔧 Provider Configuration:");
console.log(`   AgentPayStream Contract: ${AGENTPAYSTREAM_ADDRESS}`);
console.log(`   tUSD Token: ${MOCK_PAYMENT_TOKEN_ADDRESS}`);
console.log(`   RPC URL: ${SEPOLIA_RPC_URL}`);

// Apply AgentPay Middleware (validates payment streams on-chain)
app.use(agentPayMiddleware(config));

// Health check endpoint (no payment required)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Protected Premium Content Route
app.get('/api/premium', (req: any, res) => {
    const streamId = req.agentPay?.streamId || 'unknown';
    
    console.log(`📦 Serving premium content for Stream #${streamId}`);
    
    res.json({
        success: true,
        data: "🌟 This is PREMIUM content delivered via real tUSD payment streaming!",
        streamId: streamId,
        timestamp: Date.now(),
        message: "Your AI agent successfully negotiated payment and accessed this protected resource."
    });
});

// Protected AI Insight Route (higher tier)
app.get('/api/ai-insight', (req: any, res) => {
    const streamId = req.agentPay?.streamId || 'unknown';
    const txHash = req.agentPay?.txHash;
    
    console.log(`🧠 Serving AI insight for Stream #${streamId}`);
    
    res.json({
        success: true,
        insight: "Based on current market analysis: diversify your portfolio across multiple asset classes.",
        confidence: 0.87,
        streamId: streamId,
        paidWith: txHash || `stream:${streamId}`,
        timestamp: Date.now()
    });
});

// Info endpoint (no payment required)
app.get('/api/info', (req, res) => {
    res.json({
        name: "AgentPay Demo Provider",
        version: "1.0.0",
        network: "Sepolia Testnet",
        contracts: {
            agentPayStream: AGENTPAYSTREAM_ADDRESS,
            paymentToken: MOCK_PAYMENT_TOKEN_ADDRESS
        },
        protectedRoutes: [
            { path: '/api/premium', price: '0.0001 tUSD/sec', mode: 'streaming' },
            { path: '/api/ai-insight', price: '0.001 tUSD/sec', mode: 'streaming' }
        ],
        documentation: "https://agentpay.dev/docs"
    });
});

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🚀 AgentPay Demo Provider running on http://localhost:${PORT}`);
        console.log(`\n📋 Available Endpoints:`);
        console.log(`   GET /health          - Health check (free)`);
        console.log(`   GET /api/info        - API info (free)`);
        console.log(`   GET /api/premium     - Premium content (0.0001 tUSD/sec)`);
        console.log(`   GET /api/ai-insight  - AI insights (0.001 tUSD/sec)`);
        console.log(`\n💡 To test, run the consumer in another terminal:`);
        console.log(`   npx ts-node demo/consumer.ts`);
    });
}

export default app;
