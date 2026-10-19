import { AgentPaySDK } from '../sdk/src/AgentPaySDK';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { legacyConfig, legacyProvider, verifyLegacy } from './preflight';
const { cliMain } = require('../scripts/lib/cli.cjs');

/**
 * Demo Consumer: "The AI Agent Application"
 *
 * This demonstrates an AI agent that:
 * 1. Connects to Sepolia testnet with a real wallet
 * 2. Automatically negotiates x402 payments
 * 3. Creates real tUSD payment streams on-chain
 * 4. Accesses premium API content
 */
async function runDemo() {
  console.log('🚀 Starting AgentPay Demo Consumer (Real Blockchain Mode)...\n');

  const config = legacyConfig(true);
  const privateKey = config.key;
  const provider = legacyProvider(config);
  try {
    await verifyLegacy(config, provider);
    const wallet = new ethers.Wallet(privateKey, provider);
    if ((await provider.getBalance(wallet.address)) === 0n)
      throw new Error(
        'Wallet has no Sepolia ETH for gas. No transaction was sent.'
      );
    // Verify Gemini API key is available
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.warn(
        '⚠️  GEMINI_API_KEY not found - AI decision features will be limited'
      );
    }

    // 1. Initialize SDK with real Sepolia configuration
    console.log('📡 Connecting to Sepolia testnet...');
    const sdk = new AgentPaySDK({
      privateKey: privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
      rpcUrl: config.rpcUrl,
      agentId: 'Demo-Consumer-Agent-v1',
      spendingLimits: {
        dailyLimit: ethers.parseEther('100'), // 100 tUSD daily limit
        totalLimit: ethers.parseEther('1000'), // 1000 tUSD total limit
      },
    });

    console.log(`✅ Agent Wallet: ${wallet.address}`);

    // 2. Check tUSD balance before starting
    console.log('\n--- Checking tUSD Balance ---');
    const tokenContract = new ethers.Contract(
      config.token,
      [
        'function balanceOf(address) view returns (uint256)',
        'function mint(address, uint256)',
      ],
      wallet
    );

    let balance = await tokenContract.balanceOf(wallet.address);
    console.log(`💰 Current tUSD Balance: ${ethers.formatEther(balance)} tUSD`);

    // If balance is low, mint some test tokens
    if (balance < ethers.parseEther('10')) {
      console.log('\n⚠️  Low balance detected. Minting test tUSD tokens...');
      try {
        const mintTx = await tokenContract.mint(
          wallet.address,
          ethers.parseEther('100')
        );
        console.log(`📝 Mint transaction: ${mintTx.hash}`);
        await mintTx.wait();
        balance = await tokenContract.balanceOf(wallet.address);
        console.log(`✅ New tUSD Balance: ${ethers.formatEther(balance)} tUSD`);
      } catch (e: any) {
        throw new Error('Test tUSD mint failed; demo stopped before payment.');
      }
    }

    // 3. Target the provider's premium API
    const TARGET_URL = 'http://localhost:3005/api/premium';

    console.log(`\n--- [Step 1] Making Request to ${TARGET_URL} ---`);
    console.log(
      'This will trigger the x402 payment flow if the provider requires payment.\n'
    );

    try {
      // This handles the full x402 flow:
      // 1. Initial request → 402 Payment Required
      // 2. SDK reads payment requirements from headers
      // 3. AI brain decides: stream vs direct payment
      // 4. SDK approves tUSD tokens
      // 5. SDK creates payment stream on-chain
      // 6. SDK retries request with stream ID
      // 7. Provider validates stream and returns content
      const response = await sdk.makeRequest(TARGET_URL);
      console.log('✅ REQUEST SUCCESS!');
      console.log('📦 Response:', JSON.stringify(response.data, null, 2));
    } catch (e: any) {
      if (e.message.includes('ECONNREFUSED')) {
        console.error(
          '❌ Connection refused. Make sure the provider is running:'
        );
        console.error('   npx ts-node demo/provider.ts');
      } else {
        console.error('❌ Request Failed:', e.shortMessage || e.message);
      }
      throw new Error('Provider request failed; demo did not complete.');
    }

    // 4. Demonstrate stream reuse (efficiency)
    console.log(`\n--- [Step 2] Subsequent Requests (Stream Reuse) ---`);
    console.log('Sending 3 rapid requests to demonstrate stream reuse...\n');

    for (let i = 1; i <= 3; i++) {
      try {
        const response = await sdk.makeRequest(TARGET_URL);
        console.log(
          `✅ Request ${i}: Success (Stream reused - no new transaction!)`
        );
      } catch (e: any) {
        throw new Error(
          `Subsequent provider request ${i} failed; demo did not complete.`
        );
      }
    }

    // 5. Report metrics
    const metrics = sdk.getMetrics();
    console.log(`\n📊 Efficiency Report:`);
    console.log(`   Total Requests Made: ${metrics.requestsSent}`);
    console.log(`   Payment Negotiations: ${metrics.signersTriggered}`);
    console.log(
      '   Transaction/signature counts and gas savings were not measured.'
    );

    // 6. Final balance check
    const finalBalance = await tokenContract.balanceOf(wallet.address);
    console.log(
      `\n💰 Final tUSD Balance: ${ethers.formatEther(finalBalance)} tUSD`
    );
    console.log(`   Spent: ${ethers.formatEther(balance - finalBalance)} tUSD`);

    console.log('\n🎉 Demo Complete!');
    return {
      chainId: 11155111,
      tokenDecimals: 18,
      token: config.token,
      metrics,
      tokenBalanceRaw: finalBalance.toString(),
      paymentPath: 'legacy-streaming',
    };
  } finally {
    provider.destroy();
  }
}

if (require.main === module) {
  cliMain(
    'demo:consumer',
    {},
    `Usage: npm run --silent demo:consumer -- [--json] [--help]
Run the existing legacy tUSD demo against http://localhost:3005/api/premium.
This command CAN mint, approve and escrow test tokens and spend Sepolia test ETH.
Requires PRIVATE_KEY_1, AGENTPAY_STREAM_ADDRESS, PAYMENT_TOKEN_ADDRESS,
PAYMENT_RECIPIENT_ADDRESS; optional SEPOLIA_RPC_URL and GEMINI_API_KEY.
Preflight requires Sepolia 11155111, 18-decimal tUSD and matching stream/token.
The SDK negotiates a 3600-second stream; rates are 18-decimal units per second.
This is AgentPay-specific HTTP 402, not full current x402 transport.
--json  One final result envelope; progress on stderr; raw units as strings.
--help  Show help without reading keys, minting, approving or making requests.
Exit: 0 all four provider requests succeeded; 1 operation failure; 2 usage/config error.`,
    async () => {
      dotenv.config({ quiet: true });
      return runDemo();
    }
  );
}

export default runDemo;
