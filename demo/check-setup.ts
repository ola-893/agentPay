import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { legacyConfig, legacyProvider, verifyLegacy } from './preflight';
const { cliMain } = require('../scripts/lib/cli.cjs');

cliMain(
  'demo:check',
  {},
  `Usage: npm run --silent demo:check -- [--json] [--help]
Read-only check of a legacy Sepolia tUSD deployment and wallet; never mints or approves.
Requires PRIVATE_KEY_1, AGENTPAY_STREAM_ADDRESS, PAYMENT_TOKEN_ADDRESS,
PAYMENT_RECIPIENT_ADDRESS; SEPOLIA_RPC_URL defaults to publicnode.
Verifies chain 11155111, deployed bytecode, 18 decimals and stream/token binding.
Zero gas balance fails; low tUSD is reported because demo:consumer may mint test tokens.
--json  One result envelope on stdout; diagnostics on stderr. Raw token units are decimal strings.
--help  No environment, network or wallet use.
Exit: 0 configured with gas; 1 RPC/deployment/balance failure; 2 usage/config error.`,
  async () => {
    dotenv.config({ quiet: true });
    const config = legacyConfig(true);
    const provider = legacyProvider(config);
    try {
      const token = await verifyLegacy(config, provider);
      const wallet = new ethers.Wallet(config.key);
      const gas = await provider.getBalance(wallet.address);
      const balance = await token.balanceOf(wallet.address);
      if (gas === 0n)
        throw new Error(
          'Wallet has no Sepolia ETH for gas. No transaction was sent.'
        );
      const result = {
        chainId: 11155111,
        wallet: wallet.address,
        stream: config.stream,
        token: config.token,
        recipient: config.recipient,
        tokenSymbol: 'tUSD',
        tokenDecimals: 18,
        gasBalanceWei: gas.toString(),
        tokenBalanceRaw: balance.toString(),
        needsTestMint: balance < ethers.parseEther('10'),
        readOnly: true,
      };
      console.log(
        `Setup verified on Sepolia. Wallet ${
          wallet.address
        }: ${ethers.formatEther(balance)} tUSD; ${ethers.formatEther(gas)} ETH.`
      );
      if (result.needsTestMint)
        console.log(
          'Low test tUSD balance: demo:consumer may mint test tokens and spend test ETH.'
        );
      return result;
    } finally {
      provider.destroy();
    }
  }
);
