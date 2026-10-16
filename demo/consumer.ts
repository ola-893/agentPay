import { AgentPaySDK } from '../sdk/src/AgentPaySDK';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Contract addresses on Sepolia
const FLOWPAYSTREAM_ADDRESS = '0x155A00fBE3D290a8935ca4Bf5244283685Bb0035';
const MOCK_PAYMENT_TOKEN_ADDRESS = '0x96B1FE54Ee89811f46ecE4a347950E0D682D3896';
// Use a more reliable RPC endpoint
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

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
    console.log("🚀 Starting AgentPay Demo Consumer (Real Blockchain Mode)...\n");

    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY_1;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY_1 not found in .env file");
    }

    // Verify Gemini API key is available
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
        console.warn("⚠️  GEMINI_API_KEY not found - AI decision features will be limited");
    }

    // 1. Initialize SDK with real Sepolia configuration
    console.log("📡 Connecting to Sepolia testnet...");
    const sdk = new AgentPaySDK({
        privateKey: privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
        rpcUrl: SEPOLIA_RPC_URL,
        agentId: 'Demo-Consumer-Agent-v1',
        spendingLimits: {
            dailyLimit: ethers.parseEther("100"),  // 100 tUSD daily limit
            totalLimit: ethers.parseEther("1000") // 1000 tUSD total limit
        }
    });

    // Get wallet address
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`, provider);
    console.log(`✅ Agent Wallet: ${wallet.address}`);

    // 2. Check tUSD balance before starting
    console.log("\n--- Checking tUSD Balance ---");
    const tokenContract = new ethers.Contract(
        MOCK_PAYMENT_TOKEN_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'function mint(address, uint256)'],
        wallet
    );

    let balance = await tokenContract.balanceOf(wallet.address);
    console.log(`💰 Current tUSD Balance: ${ethers.formatEther(balance)} tUSD`);

    // If balance is low, mint some test tokens
    if (balance < ethers.parseEther("10")) {
        console.log("\n⚠️  Low balance detected. Minting test tUSD tokens...");
        try {
            const mintTx = await tokenContract.mint(wallet.address, ethers.parseEther("100"));
            console.log(`📝 Mint transaction: ${mintTx.hash}`);
            await mintTx.wait();
            balance = await tokenContract.balanceOf(wallet.address);
            console.log(`✅ New tUSD Balance: ${ethers.formatEther(balance)} tUSD`);
        } catch (e: any) {
            console.error("❌ Minting failed:", e.message);
            console.log("   You may need to get tUSD tokens from another source.");
        }
    }

    // 3. Target the provider's premium API
    const TARGET_URL = 'http://localhost:3005/api/premium';

    console.log(`\n--- [Step 1] Making Request to ${TARGET_URL} ---`);
    console.log("This will trigger the x402 payment flow if the provider requires payment.\n");

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
        console.log("✅ REQUEST SUCCESS!");
        console.log("📦 Response:", JSON.stringify(response.data, null, 2));
    } catch (e: any) {
        if (e.message.includes('ECONNREFUSED')) {
            console.error("❌ Connection refused. Make sure the provider is running:");
            console.error("   npx ts-node demo/provider.ts");
        } else {
            console.error("❌ Request Failed:", e.message);
        }
        return;
    }

    // 4. Demonstrate stream reuse (efficiency)
    console.log(`\n--- [Step 2] Subsequent Requests (Stream Reuse) ---`);
    console.log("Sending 3 rapid requests to demonstrate stream reuse...\n");

    for (let i = 1; i <= 3; i++) {
        try {
            const response = await sdk.makeRequest(TARGET_URL);
            console.log(`✅ Request ${i}: Success (Stream reused - no new transaction!)`);
        } catch (e: any) {
            console.error(`❌ Request ${i} failed:`, e.message);
        }
    }

    // 5. Report metrics
    const metrics = sdk.getMetrics();
    console.log(`\n📊 Efficiency Report:`);
    console.log(`   Total Requests Made: ${metrics.requestsSent}`);
    console.log(`   Blockchain Transactions: ${metrics.signersTriggered}`);
    console.log(`   ⚡ Transactions Saved: ${metrics.requestsSent - metrics.signersTriggered}`);

    // 6. Final balance check
    const finalBalance = await tokenContract.balanceOf(wallet.address);
    console.log(`\n💰 Final tUSD Balance: ${ethers.formatEther(finalBalance)} tUSD`);
    console.log(`   Spent: ${ethers.formatEther(balance - finalBalance)} tUSD`);

    console.log("\n🎉 Demo Complete!");
}

// Run the demo
if (require.main === module) {
    runDemo().catch(console.error);
}

export default runDemo;
