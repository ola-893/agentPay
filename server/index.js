const express = require('express');
const cors = require('cors');
const agentPayMiddleware = require('./middleware/agentPayMiddleware');
require('dotenv').config({ path: '../.env' }); // Load from root .env if available

// Mock Config if env vars missing
const PAYMENT_TOKEN_ADDRESS = process.env.VITE_PAYMENT_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";
const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

const app = express();
app.use(cors());
app.use(express.json());

// AgentPay Configuration
const defaultConfig = {
    rpcUrl: RPC_URL,
    recipientAddress: process.env.PAYMENT_RECIPIENT_ADDRESS || '',
    agentPayContractAddress: CONTRACT_ADDRESS,
    tokenAddress: PAYMENT_TOKEN_ADDRESS,
    routes: {
        '/api/weather': {
            price: '0.0001', // tUSD per second
            mode: 'streaming',
            description: 'Real-time weather data'
        },
        '/api/premium': {
            price: '1.0',
            mode: 'per-request',
            description: 'Premium content'
        }
    }
};

const createApp = (config = defaultConfig) => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Apply Middleware for x402 handling
    app.use(agentPayMiddleware(config));

    // Protected Route (Streaming)
    app.get('/api/weather', (req, res) => {
        res.json({
            temperature: 22,
            city: 'London',
            condition: 'Cloudy',
            paidWithStream: req.agentPay.streamId
        });
    });

    // Protected Route (Example for different pricing)
    app.get('/api/premium', (req, res) => {
        res.json({
            content: "This is premium content.",
            paidWithStream: req.agentPay.streamId
        });
    });

    // Public Route
    app.get('/api/free', (req, res) => {
        res.json({
            message: "This is free content."
        });
    });

    return app;
};

const PORT = Number(process.env.PORT || 3001);

// Start server if run directly
if (require.main === module) {
    const app = createApp();
    app.listen(PORT, () => {
        console.log(`AgentPay Test Server running on port ${PORT}`);
        console.log(`tUSD Address: ${PAYMENT_TOKEN_ADDRESS}`);
        console.log(`Contract Address: ${CONTRACT_ADDRESS}`);
    });
}

module.exports = createApp; // Export factory for testing
