/**
 * TELx Base Pool Configuration
 * 
 * Configuration for the Base v4 TELx pool.
 * Fill in the placeholders with actual values.
 */

export const TELX_BASE_CONFIG = {
  network: 'base' as const,
  positionRegistry: '0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04', // PositionRegistry on Base
  poolId: '0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b', // v4 PoolId (bytes32 hex string)
  epochStartBlock: 38000000, // Start block - UPDATE THIS with current epoch start
  epochTotalRewardTel: BigInt(0), // UPDATE THIS with actual TEL per epoch (18 decimals, e.g., BigInt("1000000000000000000000") for 1000 TEL)
  rpcUrl: 'https://mainnet.base.org', // Base mainnet RPC
};

// Example usage:
// TELX_BASE_CONFIG.positionRegistry = "0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04";
// TELX_BASE_CONFIG.poolId = "0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b";
// TELX_BASE_CONFIG.epochStartBlock = 38000000;
// TELX_BASE_CONFIG.epochTotalRewardTel = BigInt("1000000000000000000000"); // 1000 TEL (18 decimals)

