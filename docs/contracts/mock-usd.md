# MockUSD / tUSD

[Source](../../contracts/MockUSD.sol). This is a public-mint test fixture for **legacy streaming**, not Circle USDC or a monetary asset.

| Property | Value |
| --- | --- |
| Name | Mock USD |
| Symbol | tUSD |
| Decimals | 18 |
| Constructor mint | 1000000 tUSD to deployer |
| Supply limit | No cap on public minting |

The contract implements `balanceOf`, `allowance`, `approve`, `transfer`, `transferFrom`, `totalSupply`, metadata getters and `mint(address,uint256)`. Anyone can mint to any address. Approval and transfer emit the corresponding ERC-20-style events.

```ts
// Supply the deployed legacy token and connected test signer.
const token = new ethers.Contract(mockUsdAddress, [
  'function mint(address,uint256)',
  'function balanceOf(address) view returns (uint256)',
], signer);
await (await token.mint(await signer.getAddress(), ethers.parseEther('1000'))).wait();
```

The frontend **Mint 1000 test tUSD** action requires configured legacy addresses and a connected Sepolia wallet. No shared MockUSD deployment address is assumed. [Deployment](../../DEPLOYMENT.md).

Circle's test USDC uses 6 decimals and its faucet instead of this mint function. Do not point the legacy UI or SDK at USDC. [USDC policy and faucet](../USDC_SEPOLIA.md).
