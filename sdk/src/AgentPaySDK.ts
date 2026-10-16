import axios, { AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { GeminiPaymentBrain } from './GeminiPaymentBrain';
import { SpendingMonitor, SpendingLimits } from './SpendingMonitor';

export interface AgentPayConfig {
    privateKey: string;
    rpcUrl: string;
    apiKey?: string;

    spendingLimits?: SpendingLimits;
    agentId?: string;
}

export interface StreamMetadata {
    streamId: string;
    startTime: number;
    rate: bigint;
    amount: bigint;
}

export class AgentPaySDK {
    private wallet: Wallet;
    private provider: JsonRpcProvider;
    private apiKey?: string;
    private agentId?: string;

    private activeStreams: Map<string, StreamMetadata> = new Map();
    public brain: GeminiPaymentBrain;
    public monitor: SpendingMonitor;
    private isPaused: boolean = false;

    private MIN_ABI = [
        "function createStream(address recipient, uint256 duration, uint256 amount, string metadata) external",
        "function isStreamActive(uint256 streamId) external view returns (bool)",
        "function paymentToken() external view returns (address)",
        "event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, uint256 totalAmount, uint256 startTime, uint256 stopTime, string metadata)"
    ];

    private ERC20_ABI = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function transfer(address recipient, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)"
    ];

    constructor(config: AgentPayConfig) {
        this.provider = new JsonRpcProvider(config.rpcUrl);
        this.wallet = new Wallet(config.privateKey, this.provider);
        this.apiKey = config.apiKey;
        // Initialize Gemini Brain (requires separate key? reusing apiKey for simplify, but in reality likely different)
        // For Hackathon, let's assume config.apiKey is the AgentPay key, but we might pass a separate 'geminiKey' in config?
        // Let's assume config might have `geminiKey` added to interface or we use env var?
        // Let's modify interface locally or just pass undefined to safe-fail.
        this.brain = new GeminiPaymentBrain(process.env.GEMINI_API_KEY); // Assuming env var for Security
        this.agentId = config.agentId;

        // Default Limits: 100 tUSD daily, 1000 Total
        this.monitor = new SpendingMonitor(config.spendingLimits || {
            dailyLimit: ethers.parseEther("100"),
            totalLimit: ethers.parseEther("1000")
        });
    }

    // Metric counters
    private metrics = {
        requestsSent: 0,
        signersTriggered: 0
    };

    /**
     * Get efficiency metrics
     */
    public getMetrics() {
        return this.metrics;
    }

    public emergencyStop() {
        this.isPaused = true;
        console.warn("[AgentPaySDK] 🚨 EMERGENCY STOP ACTIVATED. All payments paused.");
    }

    public resume() {
        this.isPaused = false;
        console.log("[AgentPaySDK] ✅ System Resumed.");
    }



    /**
     * AI/Hybrid Payment Brain
     * Decides whether to use 'direct' (per-request) or 'stream' (streaming) mode
     * based on estimated request volume and gas costs.
     */
    public async selectPaymentMode(estimatedRequests: number): Promise<'direct' | 'stream'> {
        const decision = await this.brain.shouldStream(estimatedRequests);
        console.log(`[AgentPaySDK] 🤖 Gemini Analysis: ${decision.reasoning}`);
        return decision.mode;
    }

    public async askAgent(query: string): Promise<string> {
        return this.brain.ask(query, {
            activeStreams: this.activeStreams.size,
            metrics: this.metrics
        });
    }

    /**
     * Makes an HTTP request with automatic x402 handling
     */
    public async makeRequest(url: string, options: AxiosRequestConfig = {}): Promise<AxiosResponse> {
        if (this.isPaused) {
            throw new Error("AgentPaySDK is paused due to Emergency Stop.");
        }
        this.metrics.requestsSent++;

        // Host extraction for simple caching key
        const host = new URL(url).host;
        // In real world, we'd cache by recipient, but we don't know recipient until 402.
        // So we cache by "host/path-prefix" or just host for now as specific to our 402 server.
        const cachedStream = this.activeStreams.get(host);

        try {
            // Inject API Key if present
            const headers = { ...options.headers };
            if (this.apiKey) {
                (headers as any)['x-api-key'] = this.apiKey;
            }

            // Inject Cached Stream ID if available and valid
            if (cachedStream) {
                // Check remaining balance
                const remaining = this.calculateRemaining(cachedStream);
                // Simple threshold: if less than ~5 seconds worth of streaming left, consider it empty/risk.
                // Or just if > 0.
                if (remaining <= 0n) {
                    console.log("[AgentPaySDK] Cached stream depleted. Clearing cache...");
                    this.activeStreams.delete(host);
                } else {
                    // AUTO-RENEWAL CHECK
                    // If remaining < 10% of total amount, try to renew (create NEW stream) in background or pre-emptively?
                    // For simplicity, let's just clear cache if it's VERY low so next request triggers negotiation/top-up.
                    // Or we can be smarter: if < threshold, we delete it so we force a 402 and a new stream creation.
                    // Threshold: 10%
                    const threshold = cachedStream.amount * 10n / 100n;
                    if (remaining < threshold) {
                        console.log("[AgentPaySDK] Stream balance low (<10%). Triggering renewal...");
                        this.activeStreams.delete(host);
                        // We delete it so the request goes through without header, gets 402, and creates NEW stream.
                        // This is "Lazy Renewal".
                    } else {
                        (headers as any)['X-AgentPay-Stream-ID'] = cachedStream.streamId;
                    }
                }
            }

            const enhancedOptions = { ...options, headers };

            // 1. Attempt request
            return await axios(url, enhancedOptions);
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response && error.response.status === 402) {
                // If we used a cached stream ID and got 402, it means it expired or ran out.
                if (cachedStream) {
                    console.log("[AgentPaySDK] Cached stream failed. Clearing cache and renegotiating...");
                    this.activeStreams.delete(host);
                }

                console.log("[AgentPaySDK] 402 Payment Required intercepted. Negotiating...");
                return this.handlePaymentRequired(url, options, error.response); // Pass original options
            }
            throw error;
        }
    }

    private async handlePaymentRequired(url: string, options: AxiosRequestConfig, response: AxiosResponse): Promise<AxiosResponse> {
        this.metrics.signersTriggered++; // Negotiation requires signing

        const headers = response.headers;
        const mode = headers['x-agentpay-mode']; // 'streaming' or 'hybrid' (not robust yet, server sends fixed 'streaming' usually)
        // Let's assume server might send 'hybrid' or we decide based on capability.

        const rate = headers['x-agentpay-rate']; // amount per second or per request
        const tokenAddress = headers['x-payment-token']; // Token address
        const recipientAddress = headers['x-agentpay-recipient'] || response.data?.requirements?.recipient;
        const contractAddress = headers['x-agentpay-contract'];

        if (!contractAddress) {
            throw new Error("Missing X-AgentPay-Contract header in 402 response");
        }

        // AI Decision Point
        const simN = (options.headers as any)?.['x-simulation-n'] ? parseInt((options.headers as any)['x-simulation-n'] as string) : 10;
        const selectedMode = await this.selectPaymentMode(simN); // Await async brain

        if (selectedMode === 'direct' && headers['x-agentpay-direct-enabled'] === 'true') {
            const price = ethers.parseEther(rate || "0.0001");
            return this.performDirectPayment(url, options, tokenAddress, price, recipientAddress);
        }


        // Fallback or Stream Selection
        if (mode !== 'streaming' && mode !== 'hybrid') { // Server usually sends 'streaming'
            // If server enforces something else, error.
            // But if we chose stream, we proceed.
            throw new Error(`AgentPaySDK currently only supports 'streaming' or 'hybrid' mode. Got: ${mode}`);
        }

        // 1. Create a Stream (Existing Logic)
        // Decide on duration/amount. For this "Hackathon MVP", let's hardcode a top-up
        // e.g., 1 hour worth of streaming or a fixed small deposit.
        const duration = 3600; // 1 hour
        const rateBn = ethers.parseEther(rate || "0.0001");
        const totalAmount = rateBn * BigInt(duration);



        // SAFETY CHECKS
        try {
            this.monitor.checkAndRecordSpend(totalAmount);
        } catch (e: any) {
            console.error(`[AgentPaySDK] Spend Declined: ${e.message}`);
            throw e; // Stop payment
        }

        // Suspicious Activity Check (Frequency of renewals)
        if (this.monitor.checkSuspiciousActivity()) {
            this.emergencyStop();
            throw new Error("Suspicious renewal activity detected. System Emergency Paused.");
        }

        console.log(`[AgentPaySDK] Initiating Stream: ${ethers.formatEther(totalAmount)} tUSD for ${duration}s`);

        console.log(`[AgentPaySDK] Initiating Stream: ${ethers.formatEther(totalAmount)} tUSD for ${duration}s`);

        const streamData = await this.createStream(contractAddress, tokenAddress, totalAmount, duration, {
            type: "SDK_AUTO",
            target: url
        }, recipientAddress);

        // Cache the new stream for this host
        const host = new URL(url).host;
        this.activeStreams.set(host, {
            streamId: streamData.streamId,
            startTime: Number(streamData.startTime),
            rate: rateBn,
            amount: totalAmount
        });

        // 2. Retry Request with Header
        console.log(`[AgentPaySDK] Stream #${streamData.streamId} created. Retrying request...`);

        const retryOptions = {
            ...options,
            headers: {
                ...options.headers,
                'X-AgentPay-Stream-ID': streamData.streamId
            }
        };

        if (this.apiKey) {
            (retryOptions.headers as any)['x-api-key'] = this.apiKey;
        }

        return await axios(url, retryOptions);
    }

    public async createStream(contractAddress: string, tokenAddress: string, amount: bigint, duration: number, metadata: any = {}, recipientAddress?: string): Promise<{ streamId: string, startTime: bigint }> {
        if (!recipientAddress || !ethers.isAddress(recipientAddress) || recipientAddress === ethers.ZeroAddress || recipientAddress.toLowerCase() === tokenAddress?.toLowerCase()) {
            throw new Error('A distinct payment recipient is required before signing');
        }
        const agentPay = new Contract(contractAddress, this.MIN_ABI, this.wallet);

        // Metadata Construction
        const enrichedMetadata = {
            ...metadata,
            agentId: this.agentId || "anonymous",
            timestamp: Date.now(),
            client: "AgentPaySDK/1.0"
        };
        const metadataString = JSON.stringify(enrichedMetadata);

        // If token address is not provided in header, try fetching from contract
        let paymentToken = tokenAddress;
        if (!paymentToken) {
            try {
                paymentToken = await agentPay.paymentToken();
            } catch {
                throw new Error("Cannot determine tUSD token address");
            }
        }

        // 1. Approve Token
        const token = new Contract(paymentToken, this.ERC20_ABI, this.wallet);
        const allowance = await token.allowance(this.wallet.address, contractAddress);

        if (allowance < amount) {
            console.log("[AgentPaySDK] Approving tUSD...");
            const txApprove = await token.approve(contractAddress, amount);
            await txApprove.wait();
            console.log("[AgentPaySDK] Approved.");
        }

        const recipient = recipientAddress;

        console.log(`[AgentPaySDK] Creating stream to ${recipient}...`);

        const tx = await agentPay.createStream(recipient, duration, amount, metadataString);
        const receipt = await tx.wait();

        // Parse event to get ID
        const log = receipt.logs.find((l: any) => {
            try {
                return agentPay.interface.parseLog(l)?.name === 'StreamCreated';
            } catch { return false; }
        });

        if (!log) throw new Error("StreamCreated event not found");

        const parsed = agentPay.interface.parseLog(log);
        const streamId = parsed?.args[0].toString();
        const startTime = parsed?.args[4]; // args[4] is startTime based on ABI event def

        return { streamId, startTime };
    }

    public calculateClaimable(stream: StreamMetadata): bigint {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const start = BigInt(stream.startTime);
        if (now <= start) return 0n;

        const elapsed = now - start;
        return elapsed * stream.rate;
    }

    public calculateRemaining(stream: StreamMetadata): bigint {
        const claimable = this.calculateClaimable(stream);
        const remaining = stream.amount - claimable;
        return remaining > 0n ? remaining : 0n;
    }

    private async performDirectPayment(url: string, options: AxiosRequestConfig, tokenAddress: string, amount: bigint, recipientAddress?: string): Promise<AxiosResponse> {
        if (this.isPaused) throw new Error("AgentPaySDK is paused.");

        if (!recipientAddress || !ethers.isAddress(recipientAddress) || recipientAddress === ethers.ZeroAddress || recipientAddress.toLowerCase() === tokenAddress?.toLowerCase()) throw new Error('A distinct payment recipient is required before signing');
        // SAFETY CHECK
        this.monitor.checkAndRecordSpend(amount);

        console.log(`[AgentPaySDK] Executing Direct Payment of ${ethers.formatEther(amount)} tUSD`);

        const recipient = recipientAddress;
        const token = new Contract(tokenAddress, this.ERC20_ABI, this.wallet);

        const tx = await token.transfer(recipient, amount);
        await tx.wait();

        console.log(`[AgentPaySDK] Direct Payment Sent: ${tx.hash}`);

        const retryOptions = {
            ...options,
            headers: {
                ...options.headers,
                'X-AgentPay-Tx-Hash': tx.hash
            }
        };

        if (this.apiKey) {
            (retryOptions.headers as any)['x-api-key'] = this.apiKey;
        }

        return await axios(url, retryOptions);
    }
    public getStreamDetails(streamId: string): any {
        // In a real implementation this would fetch from Contract
        // For MVP SDK, we rely on the creation logs or cached metadata if we stored it deeper.
        // Currently we only store simple metadata in cache (StreamMetadata interface doesn't have the JSON blob).
        // Let's assume this helper is future-proof or we can parse the cache if we expand it.
        return {
            streamId,
            agentId: this.agentId || "unknown",
            client: "AgentPaySDK/1.0"
        };
    }
}
