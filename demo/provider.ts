import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { legacyConfig, legacyProvider, verifyLegacy } from './preflight';
const { cliMain } = require('../scripts/lib/cli.cjs');

// Import middleware - using require for CommonJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const agentPayMiddleware = require('../server/middleware/agentPayMiddleware');

/**
 * Demo Provider: "The Gatekeeper"
 *
 * This is a premium API service that:
 * 1. Requires tUSD payment streams for access
 * 2. Uses x402 protocol to negotiate payments
 * 3. Validates streams on-chain before serving content
 */
export async function startProvider() {
  const configEnv = legacyConfig();
  const provider = legacyProvider(configEnv);
  try {
    await verifyLegacy(configEnv, provider);
  } finally {
    provider.destroy();
  }
  const app = express();
  const PORT = 3005;

  app.use(cors());
  app.use(express.json());

  // Real blockchain configuration for Sepolia
  const config = {
    tokenAddress: configEnv.token,
    agentPayContractAddress: configEnv.stream,
    rpcUrl: configEnv.rpcUrl,
    recipientAddress: configEnv.recipient,
    routes: {
      '/api/premium': {
        mode: 'streaming',
        price: '0.0001', // 0.0001 tUSD per second
      },
      '/api/ai-insight': {
        mode: 'streaming',
        price: '0.001', // 0.001 tUSD per second (higher tier)
      },
    },
  };

  console.log('🔧 Provider Configuration:');
  console.log(`   AgentPayStream Contract: ${configEnv.stream}`);
  console.log(`   tUSD Token: ${configEnv.token}`);

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
      data: '🌟 This is PREMIUM content delivered via real tUSD payment streaming!',
      streamId: streamId,
      timestamp: Date.now(),
      message:
        'Your AI agent successfully negotiated payment and accessed this protected resource.',
    });
  });

  // Protected AI Insight Route (higher tier)
  app.get('/api/ai-insight', (req: any, res) => {
    const streamId = req.agentPay?.streamId || 'unknown';
    const txHash = req.agentPay?.txHash;

    console.log(`🧠 Serving AI insight for Stream #${streamId}`);

    res.json({
      success: true,
      insight:
        'Based on current market analysis: diversify your portfolio across multiple asset classes.',
      confidence: 0.87,
      streamId: streamId,
      paidWith: txHash || `stream:${streamId}`,
      timestamp: Date.now(),
    });
  });

  // Info endpoint (no payment required)
  app.get('/api/info', (req, res) => {
    res.json({
      name: 'AgentPay Demo Provider',
      version: '1.0.0',
      network: 'Sepolia Testnet',
      contracts: {
        agentPayStream: configEnv.stream,
        paymentToken: configEnv.token,
      },
      protectedRoutes: [
        { path: '/api/premium', price: '0.0001 tUSD/sec', mode: 'streaming' },
        { path: '/api/ai-insight', price: '0.001 tUSD/sec', mode: 'streaming' },
      ],
      documentation: 'https://agentpay.dev/docs',
    });
  });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, resolve);
    server.once('error', reject);
  });
  console.log(
    `Legacy provider listening on http://localhost:${PORT}; Sepolia tUSD deployment verified.`
  );
  return {
    chainId: 11155111,
    tokenDecimals: 18,
    stream: configEnv.stream,
    token: configEnv.token,
    recipient: configEnv.recipient,
    port: PORT,
    ready: true,
  };
}

if (require.main === module) {
  cliMain(
    'demo:provider',
    {},
    `Usage: npm run --silent demo:provider -- [--json] [--help]
Start the legacy tUSD HTTP provider on port 3005 (no wallet needed).
Requires AGENTPAY_STREAM_ADDRESS, PAYMENT_TOKEN_ADDRESS, PAYMENT_RECIPIENT_ADDRESS;
SEPOLIA_RPC_URL defaults to publicnode. Verifies Sepolia, code, 18 decimals and token binding.
Rates: /api/premium = 0.0001 tUSD/s; /api/ai-insight = 0.001 tUSD/s.
Stream IDs alone are not authenticated payer identities. No guarded receipt integration.
--json  Emit one readiness envelope after binding; subsequent logs on stderr.
--help  Show help without RPC or starting a listener.
Exit: 1 startup/RPC/deployment failure; 2 usage/config error; otherwise runs until stopped.`,
    async () => {
      dotenv.config({ quiet: true });
      return startProvider();
    }
  );
}
