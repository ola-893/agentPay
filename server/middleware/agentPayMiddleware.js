const { ethers } = require('ethers');

/**
 * AgentPay x402 Express Middleware
 * @param {Object} config Middleware configuration
 * @param {Object} config.routes Map of routes to pricing config
 * @param {string} config.tokenAddress tUSD Token Address
 * @param {string} config.agentPayContractAddress AgentPayStream Contract Address
 * @param {string} config.rpcUrl RPC URL for blockchain connection
 * @param {string} config.apiKey Optional API Key for authentication
 * @param {string} config.privateKey Optional private key for server-side signing if needed (not used for verification)
 */
const agentPayMiddleware = (config) => {
    // Initialize provider and contract OR use mock
    let agentPayContract;

    if (config.mockContract) {
        agentPayContract = config.mockContract;
    } else {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        agentPayContract = new ethers.Contract(
            config.agentPayContractAddress,
            [
                "function isStreamActive(uint256 streamId) external view returns (bool)",
                "function getClaimableBalance(uint256 streamId) external view returns (uint256)",
                "function streams(uint256 streamId) external view returns (address sender, address recipient, uint256 totalAmount, uint256 flowRate, uint256 startTime, uint256 stopTime, uint256 amountWithdrawn, bool isActive, string metadata)"
            ],
            provider
        );
    }

    return async (req, res, next) => {
        const path = req.path;

        // Find matching route config
        // Simple exact match or simple prefix match logic
        let routeConfig = config.routes[path];
        if (!routeConfig) {
            // Try finding a matching prefix if exact match fails
            const matchingKey = Object.keys(config.routes).find(key => path.startsWith(key));
            if (matchingKey) {
                routeConfig = config.routes[matchingKey];
            }
        }

        // If route is not configured for payment, proceed freely
        if (!routeConfig) {
            return next();
        }

        // 0. API Key Authentication (Requirement 3.4)
        if (config.apiKey) {
            const clientKey = req.headers['x-api-key'];
            if (!clientKey || clientKey !== config.apiKey) {
                return res.status(401).json({ error: "Unauthorized: Invalid or missing API Key" });
            }
        }

        const streamIdHeader = req.headers['x-agentpay-stream-id'];
        const txHashHeader = req.headers['x-agentpay-tx-hash'];

        // 1. Check for Direct Payment (Tx Hash) (Requirement: Hybrid Mode)
        if (txHashHeader) {
            return res.status(402).json({ error: 'Direct transaction-hash payments are disabled. Use a verified stream or CRE guarded settlement.' });
        }

        // Calculate required amount from route config
        const requiredAmount = ethers.parseEther(routeConfig.price || '0');

        // 2. Check for Stream ID Header
        if (!streamIdHeader) {
            return send402Response(res, routeConfig, config, requiredAmount);
        }

        try {
            // 2. Verify Stream ID
            const streamId = BigInt(streamIdHeader);
            const isActive = await agentPayContract.isStreamActive(streamId);

            if (!isActive) {
                // Stream exists but is inactive
                return res.status(402).json({
                    error: "Stream is inactive",
                    detail: "The provided stream ID is not active. Please open a new stream or top up."
                });
            }

            const stream = await agentPayContract.streams(streamId);
            const now = Math.floor(Date.now() / 1000);
            if (!ethers.isAddress(config.recipientAddress || '')
                || stream.recipient.toLowerCase() !== config.recipientAddress.toLowerCase()
                || Number(stream.stopTime) <= now || Number(stream.startTime) > now
                || BigInt(stream.flowRate) < requiredAmount) {
                return res.status(402).json({ error: 'Stream does not satisfy this provider payment policy' });
            }

            // Track metrics (simple console log for MVP)
            console.log(`[AgentPay] Request accepted for ${path} using Stream #${streamId}`);

            // Attach stream info to request for downstream use
            req.agentPay = {
                streamId: streamId.toString()
            };

            next();
        } catch (error) {
            console.error("[AgentPay] Stream verification failed:", error);
            // Fallback to 402 if verification crashes (safe default)
            const requiredAmountFallback = ethers.parseEther(routeConfig.price || '0');
            return send402Response(res, routeConfig, config, requiredAmountFallback);
        }
    };
};

function send402Response(res, routeConfig, config, requiredAmount) {
    res.set('X-Payment-Required', 'true');
    res.set('X-AgentPay-Mode', routeConfig.mode || 'streaming');
    res.set('X-AgentPay-Rate', ethers.formatEther(requiredAmount)); // Send resolved rate
    res.set('X-Payment-Token', config.tokenAddress || '');
    res.set('X-AgentPay-Recipient', config.recipientAddress || '');
    res.set('X-AgentPay-Contract', config.agentPayContractAddress || '');
    // Standard 402 body
    res.status(402).json({
        message: "Payment Required",
        requirements: {
            mode: routeConfig.mode || 'streaming',
            price: ethers.formatEther(requiredAmount), // Use the resolved rate
            currency: "tUSD",
            contract: config.agentPayContractAddress,
            recipient: config.recipientAddress
        }
    });
}

module.exports = agentPayMiddleware;

