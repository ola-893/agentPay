# Configuration

AgentPay offers extensive configuration options for different use cases.

## SDK Configuration

```typescript
import { AgentPaySDK } from './sdk/src/AgentPaySDK';

const sdk = new AgentPaySDK({
  // Required
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: 'https://rpc.sepolia.org',
  contractAddress: 'YOUR_AGENTPAY_STREAM_ADDRESS',
  tokenAddress: 'YOUR_TEST_TOKEN_ADDRESS',
  
  // Optional
  agentId: 'my-agent-001',
  defaultStreamDuration: 3600, // 1 hour
  autoApproveTokens: true,
  maxRetries: 3,
  retryDelay: 1000
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `privateKey` | string | required | Wallet private key |
| `rpcUrl` | string | required | Ethereum RPC endpoint |
| `contractAddress` | string | required | AgentPayStream contract address |
| `tokenAddress` | string | required | tUSD token address |
| `agentId` | string | auto | Unique agent identifier |
| `defaultStreamDuration` | number | 3600 | Default stream duration (seconds) |
| `autoApproveTokens` | boolean | true | Auto-approve token allowance |
| `maxRetries` | number | 3 | Max retry attempts for failed requests |
| `retryDelay` | number | 1000 | Delay between retries (ms) |

## Spending Monitor Configuration

```typescript
import { SpendingMonitor } from './sdk/src/SpendingMonitor';

const monitor = new SpendingMonitor({
  dailyLimit: '100',      // 100 tUSD per day
  perRequestLimit: '1',   // 1 tUSD max per request
  emergencyStopThreshold: '500', // Stop if total exceeds 500 tUSD
  alertCallback: (alert) => {
    console.log('Spending alert:', alert);
  }
});
```

## Gemini AI Configuration

```typescript
import { GeminiPaymentBrain } from './sdk/src/GeminiPaymentBrain';

const brain = new GeminiPaymentBrain({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-pro',
  decisionThreshold: 0.7,
  preferStreaming: true,
  costOptimization: 'aggressive' // 'conservative' | 'balanced' | 'aggressive'
});
```

## Middleware Configuration

```javascript
const { agentPayMiddleware } = require('./middleware/agentPayMiddleware');

app.use('/api/premium', agentPayMiddleware({
  // Pricing
  pricePerRequest: '0.001',
  pricingModel: 'per-request', // 'per-request' | 'per-byte' | 'per-second'
  
  // Contract
  contractAddress: 'YOUR_AGENTPAY_STREAM_ADDRESS',
  tokenAddress: 'YOUR_TEST_TOKEN_ADDRESS',
  recipientAddress: '0x...',
  
  // Verification
  minStreamBalance: '0.01',
  verifyOnChain: true,
  cacheVerification: true,
  cacheTTL: 60000, // 1 minute
  
  // Headers
  customHeaders: {
    'X-Provider-Name': 'MyAPI'
  }
}));
```

## Frontend Configuration

Create `vite-project/.env`:

```bash
# Contract addresses
VITE_CONTRACT_ADDRESS=YOUR_AGENTPAY_STREAM_ADDRESS
VITE_PAYMENT_TOKEN_ADDRESS=YOUR_TEST_TOKEN_ADDRESS

# Network
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://rpc.sepolia.org

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_AI_CONSOLE=true
```

## Network Configuration

### Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Sepolia | 11155111 | ✅ Active |
| Mainnet | 1 | 🔜 Coming Soon |

### Custom RPC Endpoints

```javascript
const RPC_URLS = {
  sepolia: {
    primary: 'https://rpc.sepolia.org',
    fallback: [
      'https://sepolia.infura.io/v3/YOUR_KEY',
      'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY'
    ]
  }
};
```

## Security Configuration

### Private Key Management

Never hardcode private keys. Use environment variables or secure vaults:

```bash
# .env (never commit this file!)
PRIVATE_KEY=0x...
```

### Rate Limiting

```javascript
const rateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  skipSuccessfulRequests: false
};
```

## Next Steps

- [Architecture Overview](../architecture/README.md)
- [SDK Reference](../sdk/README.md)
