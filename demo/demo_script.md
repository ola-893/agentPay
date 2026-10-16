# AgentPay Demo Script

**Title**: AgentPay - Real-Time tUSD Payment Streaming for AI Agents
**Network**: Sepolia Testnet (Real Blockchain Transactions)

---

## Prerequisites

1. **Environment Setup**: Ensure `.env` has:
   ```
   PRIVATE_KEY_1=your_private_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   cd sdk && npm install && cd ..
   ```

3. **Get Test tUSD Tokens**: The demo will auto-mint if balance is low, or use the frontend at `http://localhost:5173` to mint tokens.

---

## Running the Demo

### Step 1: Start the Provider (Terminal 1)

```bash
npx ts-node demo/provider.ts
```

**Expected Output**:
```
🔧 Provider Configuration:
   AgentPayStream Contract: YOUR_AGENTPAY_STREAM_ADDRESS
   tUSD Token: YOUR_TEST_TOKEN_ADDRESS
   RPC URL: https://rpc.sepolia.org

🚀 AgentPay Demo Provider running on http://localhost:3005

📋 Available Endpoints:
   GET /health          - Health check (free)
   GET /api/info        - API info (free)
   GET /api/premium     - Premium content (0.0001 tUSD/sec)
   GET /api/ai-insight  - AI insights (0.001 tUSD/sec)
```

The provider is now a "gatekeeper" that requires tUSD payment streams for premium content.

---

### Step 2: Run the Consumer Agent (Terminal 2)

```bash
npx ts-node demo/consumer.ts
```

**What Happens (Real Blockchain)**:

1. **Wallet Connection**: Agent connects to Sepolia with `PRIVATE_KEY_1`
2. **Balance Check**: Verifies tUSD balance, mints if needed
3. **x402 Flow**:
   - Agent requests `/api/premium`
   - Provider returns `402 Payment Required` with requirements
   - SDK reads payment headers (rate, contract address, token)
   - Gemini AI decides: stream vs direct payment
   - SDK approves tUSD tokens on-chain
   - SDK creates payment stream on-chain
   - SDK retries request with stream ID
   - Provider validates stream and returns content
4. **Stream Reuse**: Subsequent requests reuse the same stream (no new transactions!)

**Expected Output**:
```
🚀 Starting AgentPay Demo Consumer (Real Blockchain Mode)...

📡 Connecting to Sepolia testnet...
✅ Agent Wallet: 0x...

--- Checking tUSD Balance ---
💰 Current tUSD Balance: 100.0 tUSD

--- [Step 1] Making Request to http://localhost:3005/api/premium ---
[AgentPaySDK] 402 Payment Required intercepted. Negotiating...
[AgentPaySDK] 🤖 Gemini Analysis: High request volume expected, streaming is more efficient
[AgentPaySDK] Initiating Stream: 0.36 tUSD for 3600s
[AgentPaySDK] Approving tUSD...
[AgentPaySDK] Approved.
[AgentPaySDK] Creating stream to YOUR_TEST_TOKEN_ADDRESS...
[AgentPaySDK] Stream #X created. Retrying request...
✅ REQUEST SUCCESS!
📦 Response: { "success": true, "data": "🌟 This is PREMIUM content..." }

--- [Step 2] Subsequent Requests (Stream Reuse) ---
✅ Request 1: Success (Stream reused - no new transaction!)
✅ Request 2: Success (Stream reused - no new transaction!)
✅ Request 3: Success (Stream reused - no new transaction!)

📊 Efficiency Report:
   Total Requests Made: 4
   Blockchain Transactions: 1
   ⚡ Transactions Saved: 3

💰 Final tUSD Balance: 99.64 tUSD
   Spent: 0.36 tUSD

🎉 Demo Complete!
```

---

## Key Concepts Demonstrated

### 1. x402 Protocol
The provider returns HTTP 402 with payment requirements in headers:
- `X-AgentPay-Mode: streaming`
- `X-AgentPay-Rate: 0.0001` (tUSD per second)
- `X-AgentPay-Contract: YOUR_AGENTPAY_STREAM_ADDRESS`
- `X-Payment-Token: YOUR_TEST_TOKEN_ADDRESS`

### 2. AI-Powered Payment Decisions
The Gemini AI brain analyzes:
- Expected request volume
- Gas costs vs streaming costs
- Decides optimal payment mode (stream vs direct)

### 3. Stream Efficiency
- **Problem**: Per-request payments = N transactions for N requests
- **Solution**: One stream transaction serves unlimited requests
- **Result**: Massive gas savings for high-frequency API access

### 4. Real Blockchain Transactions
All transactions are real and verifiable on Sepolia:
- View on Etherscan: `https://sepolia.etherscan.io/address/YOUR_WALLET`
- Contract: `https://sepolia.etherscan.io/address/YOUR_AGENTPAY_STREAM_ADDRESS`

---

## Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| AgentPayStream | `YOUR_AGENTPAY_STREAM_ADDRESS` |
| MockUSD | `YOUR_TEST_TOKEN_ADDRESS` |

---

## Troubleshooting

**"PRIVATE_KEY_1 not found"**: Add your private key to `.env`

**"Connection refused"**: Make sure provider is running first

**"Insufficient tUSD balance"**: The demo auto-mints, or use the frontend to mint

**"Transaction failed"**: Check you have Sepolia ETH for gas (get from faucet)

---

## Frontend Dashboard

For a visual experience, run the frontend:
```bash
cd vite-project && npm run dev
```

Then open `http://localhost:5173` to:
- View live stream balances
- Create/cancel streams manually
- Monitor AI agent activity
