/**
 * Quick setup verification script
 * Run: npx ts-node demo/check-setup.ts
 */
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const AGENTPAYSTREAM_ADDRESS = process.env.AGENTPAY_STREAM_ADDRESS || '';
const MOCK_PAYMENT_TOKEN_ADDRESS = process.env.PAYMENT_TOKEN_ADDRESS || '';
// Use a more reliable RPC endpoint
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

async function checkSetup() {
    console.log("🔍 AgentPay Demo Setup Check\n");

    // 1. Check environment variables
    console.log("1️⃣  Environment Variables:");
    const privateKey = process.env.PRIVATE_KEY_1;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (privateKey) {
        console.log("   ✅ PRIVATE_KEY_1: Found");
    } else {
        console.log("   ❌ PRIVATE_KEY_1: Missing - Add to .env file");
    }

    if (geminiKey) {
        console.log("   ✅ GEMINI_API_KEY: Found");
    } else {
        console.log("   ⚠️  GEMINI_API_KEY: Missing - AI features will use fallback heuristics");
    }

    if (!privateKey) {
        console.log("\n❌ Cannot continue without PRIVATE_KEY_1");
        return;
    }

    // 2. Check network connection
    console.log("\n2️⃣  Network Connection:");
    try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        const network = await provider.getNetwork();
        console.log(`   ✅ Connected to: ${network.name} (chainId: ${network.chainId})`);
    } catch (e: any) {
        console.log(`   ❌ Failed to connect: ${e.message}`);
        return;
    }

    // 3. Check wallet
    console.log("\n3️⃣  Wallet:");
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(
        privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
        provider
    );
    console.log(`   📍 Address: ${wallet.address}`);

    // 4. Check ETH balance (for gas)
    const ethBalance = await provider.getBalance(wallet.address);
    console.log(`   ⛽ ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
    if (ethBalance < ethers.parseEther("0.01")) {
        console.log("   ⚠️  Low ETH balance - Get Sepolia ETH from a faucet");
    }

    // 5. Check tUSD balance
    console.log("\n4️⃣  tUSD Token:");
    const tokenContract = new ethers.Contract(
        MOCK_PAYMENT_TOKEN_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    const tokenBalance = await tokenContract.balanceOf(wallet.address);
    console.log(`   💰 tUSD Balance: ${ethers.formatEther(tokenBalance)} tUSD`);
    if (tokenBalance < ethers.parseEther("1")) {
        console.log("   ⚠️  Low tUSD balance - Demo will auto-mint or use frontend to mint");
    }

    // 6. Check contracts exist
    console.log("\n5️⃣  Contracts:");
    const agentPayStreamCode = await provider.getCode(AGENTPAYSTREAM_ADDRESS);
    const tokenCode = await provider.getCode(MOCK_PAYMENT_TOKEN_ADDRESS);

    if (agentPayStreamCode !== '0x') {
        console.log(`   ✅ AgentPayStream: ${AGENTPAYSTREAM_ADDRESS}`);
    } else {
        console.log(`   ❌ AgentPayStream not deployed at ${AGENTPAYSTREAM_ADDRESS}`);
    }

    if (tokenCode !== '0x') {
        console.log(`   ✅ MockUSD: ${MOCK_PAYMENT_TOKEN_ADDRESS}`);
    } else {
        console.log(`   ❌ MockUSD not deployed at ${MOCK_PAYMENT_TOKEN_ADDRESS}`);
    }

    console.log("\n✅ Setup check complete!");
    console.log("\nTo run the demo:");
    console.log("   Terminal 1: npx ts-node demo/provider.ts");
    console.log("   Terminal 2: npx ts-node demo/consumer.ts");
}

checkSetup().catch(console.error);
