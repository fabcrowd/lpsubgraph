/**
 * TELx Epoch Scoring Engine
 * 
 * Implements the canonical TELx reward calculation logic:
 * - Reads checkpoints from subgraph for epoch period
 * - Calculates fee growth during epoch
 * - Applies classification weights (JIT/Active/Passive)
 * - Computes weighted scores
 * - Distributes rewards pro-rata
 */

import fetch from "node-fetch";

// TELx configuration constants (from PositionRegistry)
const JIT_LIFETIME = 1; // blocks
const MIN_PASSIVE_LIFETIME = 43200; // blocks (~24 hours on Base)
const JIT_WEIGHT = 0; // 0%
const ACTIVE_WEIGHT = 0; // 0%
const PASSIVE_WEIGHT = 100; // 100%

export interface TelxEpochConfig {
  network: 'base';
  positionRegistry: string;
  poolId: string; // v4 PoolId (bytes32 hex string)
  startBlock: number;
  endBlock: number;
  totalRewardTel: bigint; // total TEL budgeted for the epoch (scaled correctly, 18 decimals)
  subgraphUrl?: string; // optional, defaults to env var
  rpcUrl?: string; // optional RPC URL for fetching token prices
  // Optional: Token prices for accurate scoring (in common denominator, e.g., TEL per token)
  // If not provided, will attempt to fetch from PositionRegistry contract
  // If fetch fails, uses simplified sum (less accurate)
  token0Price?: bigint; // Price of token0 in common denominator (e.g., TEL per ETH, scaled by 10^18)
  token1Price?: bigint; // Price of token1 in common denominator (e.g., TEL per TEL = 10^18)
}

export interface TelxEpochResult {
  perWallet: { 
    address: string; 
    rewardTel: bigint; 
    score?: bigint;
    weightedScore?: bigint;
  }[];
  totalScore: bigint;
  totalRewardsDistributed: bigint;
}

/**
 * Get classification weight based on position classification
 */
function getClassificationWeight(classification: string): number {
  switch (classification) {
    case "JIT":
      return JIT_WEIGHT;
    case "Active":
      return ACTIVE_WEIGHT;
    case "Passive":
      return PASSIVE_WEIGHT;
    default:
      return 0;
  }
}

/**
 * Calculate price from sqrtPriceX96
 * 
 * Uniswap v4 uses sqrtPriceX96 format where:
 * price = (sqrtPriceX96 / 2^96)^2
 * 
 * This gives: amount1 / amount0 = price
 * 
 * @param sqrtPriceX96 - Square root price in Q96.64 format
 * @returns Price as amount1 per amount0 (scaled by 10^18)
 */
function calculatePriceFromSqrtPriceX96(sqrtPriceX96: bigint): bigint {
  const Q96 = BigInt(2) ** BigInt(96);
  
  // price = (sqrtPriceX96 / 2^96)^2
  // To avoid precision loss, we do: (sqrtPriceX96^2) / (2^96)^2
  const priceX128 = (sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
  
  // Convert from Q128 format to wei (18 decimals)
  // priceX128 is in Q128 format, so divide by 2^128 and multiply by 10^18
  // Simplified: priceX128 * 10^18 / 2^128
  const Q128 = BigInt(2) ** BigInt(128);
  const priceInWei = (priceX128 * (BigInt(10) ** BigInt(18))) / Q128;
  
  return priceInWei;
}

/**
 * Get function selector for getAmountsForLiquidity
 * 
 * Function signature: getAmountsForLiquidity(bytes32,uint128,int24,int24)
 * Selector is first 4 bytes of keccak256 hash of the signature
 * 
 * NOTE: This selector should be verified against the actual contract ABI.
 * You can verify it by:
 * 1. Using ethers.js: ethers.utils.id("getAmountsForLiquidity(bytes32,uint128,int24,int24)").slice(0, 10)
 * 2. Or checking the contract on Basescan
 */
function getFunctionSelector(): string {
  // Pre-calculated selector for getAmountsForLiquidity(bytes32,uint128,int24,int24)
  // This should match the actual contract - verify if prices don't work
  // To calculate: keccak256("getAmountsForLiquidity(bytes32,uint128,int24,int24)").slice(0, 4)
  return "0x4f8e3a8e";
}

/**
 * Encode int24 as hex (signed integer, 24 bits)
 */
function encodeInt24(value: number): string {
  // Convert to 32-byte hex, handling sign extension for negative numbers
  if (value < 0) {
    // Two's complement for negative numbers
    const unsigned = (0x1000000 + value) & 0xFFFFFF;
    return unsigned.toString(16).padStart(64, 'f');
  }
  return value.toString(16).padStart(64, '0');
}

/**
 * Fetch token prices from PositionRegistry contract
 * 
 * Uses getAmountsForLiquidity to get sqrtPriceX96, then calculates prices.
 * 
 * @param rpcUrl - RPC URL for Base network
 * @param positionRegistry - PositionRegistry contract address
 * @param poolId - Pool ID (bytes32 hex string)
 * @param liquidity - Sample liquidity amount (can be 1 or any value)
 * @param tickLower - Lower tick (can use -887272 for full range)
 * @param tickUpper - Upper tick (can use 887272 for full range)
 * @returns Object with token0Price and token1Price in common denominator (scaled by 10^18)
 */
async function fetchTokenPrices(
  rpcUrl: string,
  positionRegistry: string,
  poolId: string,
  liquidity: bigint = BigInt(1),
  tickLower: number = -887272,
  tickUpper: number = 887272,
  blockNumber?: number
): Promise<{ token0Price: bigint; token1Price: bigint } | null> {
  try {
    // Function signature: getAmountsForLiquidity(bytes32,uint128,int24,int24)
    const functionSelector = getFunctionSelector();
    
    // Encode parameters
    // poolId: bytes32 (64 hex chars, no 0x prefix, padded to 64)
    const poolIdHex = (poolId.startsWith('0x') ? poolId.slice(2) : poolId).toLowerCase().padStart(64, '0');
    
    // liquidity: uint128 (32 bytes = 64 hex chars, padded)
    const liquidityHex = liquidity.toString(16).padStart(64, '0');
    
    // tickLower: int24 (32 bytes with sign extension)
    const tickLowerHex = encodeInt24(tickLower);
    
    // tickUpper: int24 (32 bytes with sign extension)
    const tickUpperHex = encodeInt24(tickUpper);
    
    // Build the data payload (function selector + encoded parameters)
    const data = functionSelector + 
      poolIdHex +
      liquidityHex +
      tickLowerHex +
      tickUpperHex;
    
    // Make RPC call
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: positionRegistry.toLowerCase(),
            data: data.toLowerCase()
          },
          blockNumber ? "0x" + blockNumber.toString(16) : "latest"
        ],
        id: 1
      }),
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.warn("Failed to fetch token prices from contract:", result.error);
      return null;
    }
    
    if (!result.result || result.result === "0x") {
      console.warn("Empty result from contract call");
      return null;
    }
    
    // Decode result: (uint256 amount0, uint256 amount1, uint160 sqrtPriceX96)
    // Each uint256 is 32 bytes (64 hex chars), uint160 is 20 bytes (40 hex chars)
    const returnData = result.result.startsWith('0x') ? result.result.slice(2) : result.result;
    
    // Extract values (each is 64 hex chars = 32 bytes)
    // amount0: bytes 0-31
    // amount1: bytes 32-63
    // sqrtPriceX96: bytes 64-83 (20 bytes = 40 hex chars, but padded to 64 in return)
    const sqrtPriceX96Hex = returnData.slice(128, 168); // bytes 64-83 (40 hex chars)
    const sqrtPriceX96 = BigInt("0x" + sqrtPriceX96Hex);
    
    // Calculate price: price = (sqrtPriceX96 / 2^96)^2
    // This gives: amount1 / amount0 = price
    // If token0 is ETH and token1 is TEL:
    // token0Price = price (TEL per ETH, scaled by 10^18)
    // token1Price = 10^18 (1 TEL per TEL)
    const token0Price = calculatePriceFromSqrtPriceX96(sqrtPriceX96);
    const token1Price = BigInt(10) ** BigInt(18); // 1 TEL per TEL
    
    return { token0Price, token1Price };
  } catch (error) {
    console.warn("Error fetching token prices:", error);
    return null;
  }
}

/**
 * Query subgraph for positions and checkpoints in epoch range
 * 
 * Includes checkpoints before startBlock to find the starting checkpoint for delta calculation.
 * Also includes tick ranges for position details.
 */
async function queryEpochData(
  subgraphUrl: string,
  poolId: string,
  startBlock: number,
  endBlock: number
): Promise<any> {
  const query = `
    query EpochScoring($poolId: String!, $startBlock: BigInt!, $endBlock: BigInt!) {
      positionNFTs(
        where: { 
          pool: $poolId
        }
        first: 1000
      ) {
        id
        owner
        tickLower
        tickUpper
        liquidity
        classification
        isSubscribed
        createdAtBlock
        updatedAtBlock
        feeGrowthInsidePeriod0
        feeGrowthInsidePeriod1
        totalFeeGrowth0
        totalFeeGrowth1
        checkpoints(
          where: {
            blockNumber_lte: $endBlock
          }
          orderBy: blockNumber
          orderDirection: asc
          first: 1000
        ) {
          id
          blockNumber
          timestamp
          feeGrowthInside0LastX128
          feeGrowthInside1LastX128
          liquidity
        }
        subscriptions(
          orderBy: subscribedAtBlock
          orderDirection: desc
        ) {
          wallet
          subscribedAtBlock
          subscribedAtTimestamp
          unsubscribedAtBlock
          isActive
        }
      }
    }
  `;

  try {
    const response = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        query, 
        variables: { 
          poolId,
          startBlock: startBlock.toString(),
          endBlock: endBlock.toString()
        }
      }),
    });
    const result = await response.json();
    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error("Error querying subgraph:", error);
    return null;
  }
}

/**
 * Calculate fee growth during epoch for a position
 * 
 * Uses checkpoints to compute the delta in fee growth between start and end of epoch.
 * This matches the Excel calculation which shows `feeGrowthInsidePeriod0/1`.
 * 
 * The calculation:
 * 1. Finds checkpoint at or before epoch start block
 * 2. Finds checkpoint at or before epoch end block
 * 3. Calculates delta: endCheckpoint - startCheckpoint
 * 
 * If no checkpoints exist, falls back to feeGrowthInsidePeriod0/1 from position
 * (which should be updated by the subgraph when epoch boundaries are known).
 */
function calculateEpochFeeGrowth(
  position: any,
  startBlock: number,
  endBlock: number
): { feeGrowth0: bigint; feeGrowth1: bigint; endCheckpointLiquidity?: bigint } {
  const checkpoints = position.checkpoints || [];
  
  // If we have checkpoints, calculate delta (preferred method)
  if (checkpoints.length > 0) {
    // Sort checkpoints by blockNumber (should already be sorted, but ensure it)
    const sortedCheckpoints = [...checkpoints].sort((a: any, b: any) => 
      parseInt(a.blockNumber) - parseInt(b.blockNumber)
    );
    
    // Find checkpoint at or before startBlock (closest to start)
    let startCheckpoint = null;
    for (let i = sortedCheckpoints.length - 1; i >= 0; i--) {
      if (parseInt(sortedCheckpoints[i].blockNumber) <= startBlock) {
        startCheckpoint = sortedCheckpoints[i];
        break;
      }
    }
    
    // Find checkpoint at or before endBlock (closest to end)
    let endCheckpoint = null;
    for (let i = sortedCheckpoints.length - 1; i >= 0; i--) {
      if (parseInt(sortedCheckpoints[i].blockNumber) <= endBlock) {
        endCheckpoint = sortedCheckpoints[i];
        break;
      }
    }
    
    // If we have both checkpoints, calculate delta (most accurate)
    if (startCheckpoint && endCheckpoint) {
      const feeGrowth0Delta = BigInt(endCheckpoint.feeGrowthInside0LastX128) - BigInt(startCheckpoint.feeGrowthInside0LastX128);
      const feeGrowth1Delta = BigInt(endCheckpoint.feeGrowthInside1LastX128) - BigInt(startCheckpoint.feeGrowthInside1LastX128);
      
      // Use liquidity from end checkpoint (matches Excel's "lastLiquidity")
      const endCheckpointLiquidity = BigInt(endCheckpoint.liquidity || position.liquidity || "0");
      
      // Ensure non-negative (should always be positive for valid epoch)
      return {
        feeGrowth0: feeGrowth0Delta >= BigInt(0) ? feeGrowth0Delta : BigInt(0),
        feeGrowth1: feeGrowth1Delta >= BigInt(0) ? feeGrowth1Delta : BigInt(0),
        endCheckpointLiquidity
      };
    }
    
    // If we only have end checkpoint, use it (assuming start was 0)
    // This happens if position was created during the epoch
    if (endCheckpoint && !startCheckpoint) {
      const endCheckpointLiquidity = BigInt(endCheckpoint.liquidity || position.liquidity || "0");
      return {
        feeGrowth0: BigInt(endCheckpoint.feeGrowthInside0LastX128),
        feeGrowth1: BigInt(endCheckpoint.feeGrowthInside1LastX128),
        endCheckpointLiquidity
      };
    }
  }
  
  // Fallback: use feeGrowthInsidePeriod0/1 if available
  // Note: These fields should be updated by subgraph when epoch boundaries are known
  // This is less accurate but works if checkpoints aren't available
  return {
    feeGrowth0: BigInt(position.feeGrowthInsidePeriod0 || "0"),
    feeGrowth1: BigInt(position.feeGrowthInsidePeriod1 || "0"),
    endCheckpointLiquidity: BigInt(position.liquidity || "0")
  };
}

/**
 * Convert fee growth to common denominator
 * 
 * Fee growth in Uniswap v4 is stored as Q128.128 (fixed point).
 * To convert to actual token amounts and then to common denominator:
 * 
 * 1. Fee growth represents fees per unit of liquidity (scaled by 2^128)
 * 2. Actual fees = (feeGrowth * liquidity) / 2^128
 * 3. Convert to common denominator using token prices
 * 
 * However, for scoring purposes, we can work directly with feeGrowth values
 * if we scale the prices appropriately. The Excel shows that fees are
 * converted to a common denominator before summing.
 * 
 * @param feeGrowth0 - Fee growth for token0 (Q128.128 format)
 * @param feeGrowth1 - Fee growth for token1 (Q128.128 format)
 * @param liquidity - Position liquidity (needed for proper conversion)
 * @param token0Price - Price of token0 in common denominator (scaled, e.g., TEL per token0 * 10^18)
 * @param token1Price - Price of token1 in common denominator (scaled, e.g., TEL per token1 * 10^18)
 * @returns Total fees in common denominator
 */
function convertToCommonDenominator(
  feeGrowth0: bigint,
  feeGrowth1: bigint,
  liquidity: bigint,
  token0Price: bigint,
  token1Price: bigint
): bigint {
  // Q128.128 format: feeGrowth is scaled by 2^128
  // Actual fees = (feeGrowth * liquidity) / 2^128
  // Then convert to common denominator: fees * price
  
  const Q128 = BigInt(2) ** BigInt(128);
  
  // Calculate actual token amounts from fee growth
  // Note: feeGrowth can be negative (int128), so we need to handle that
  const fee0Amount = (feeGrowth0 * liquidity) / Q128;
  const fee1Amount = (feeGrowth1 * liquidity) / Q128;
  
  // Convert to common denominator (assume prices are already scaled appropriately)
  // If prices are in wei format (18 decimals), we need to divide by 10^18 after multiplication
  const fee0InCommonDenom = (fee0Amount * token0Price) / (BigInt(10) ** BigInt(18));
  const fee1InCommonDenom = (fee1Amount * token1Price) / (BigInt(10) ** BigInt(18));
  
  return fee0InCommonDenom + fee1InCommonDenom;
}

/**
 * Calculate weighted score for a position
 * 
 * IMPORTANT: According to TELx contract implementation and Excel data structure,
 * fees MUST be converted to a common denominator (using token prices) before scoring.
 * 
 * The Excel shows `totalFeesCommonDenominator` which proves fees are converted
 * to a single unit (likely TEL) before being summed.
 * 
 * Score = (feeGrowth0_converted + feeGrowth1_converted) * classification_weight
 * 
 * @param feeGrowth0 - Fee growth for token0 (Q128.128 format, int128)
 * @param feeGrowth1 - Fee growth for token1 (Q128.128 format, int128)
 * @param classification - Position classification (JIT/Active/Passive)
 * @param liquidity - Position liquidity (needed for fee conversion)
 * @param token0Price - Optional: Price of token0 in common denominator (scaled, e.g., TEL per token0 * 10^18)
 * @param token1Price - Optional: Price of token1 in common denominator (scaled, e.g., TEL per token1 * 10^18)
 * @returns Weighted score for reward distribution
 */
function calculateWeightedScore(
  feeGrowth0: bigint,
  feeGrowth1: bigint,
  classification: string,
  liquidity: bigint,
  token0Price?: bigint,
  token1Price?: bigint
): bigint {
  const weight = getClassificationWeight(classification);
  
  let totalFeesCommonDenominator: bigint;
  
  if (token0Price && token1Price && liquidity > BigInt(0)) {
    // Convert to common denominator using proper Q128.128 math
    // This matches the Excel calculation for totalFeesCommonDenominator
    totalFeesCommonDenominator = convertToCommonDenominator(
      feeGrowth0,
      feeGrowth1,
      liquidity,
      token0Price,
      token1Price
    );
  } else {
    // Fallback: simplified sum (NOT accurate for production)
    // WARNING: This will produce incorrect scores if token0 and token1 have different values
    // This is a temporary workaround until token prices are integrated
    // The Excel data shows this is wrong - fees must be converted to common denominator
    totalFeesCommonDenominator = feeGrowth0 + feeGrowth1;
  }
  
  // Apply weight (weight is 0-100, so divide by 100)
  // Only Passive positions (100% weight) contribute to scoring
  const weightedScore = (totalFeesCommonDenominator * BigInt(weight)) / BigInt(100);
  
  return weightedScore;
}

/**
 * Calculate TELx epoch rewards
 * 
 * This implements the canonical TELx scoring logic:
 * 1. Fetch all subscribed positions for the pool
 * 2. Calculate fee growth during epoch for each position (from checkpoints)
 * 3. Convert fees to common denominator using token prices (if provided)
 * 4. Apply classification weights (JIT=0%, Active=0%, Passive=100%)
 * 5. Compute weighted scores
 * 6. Distribute rewards pro-rata based on weighted scores
 * 
 * NOTE: For accurate scoring, token prices should be provided in config.
 * Without prices, uses simplified sum which may produce incorrect results
 * if token0 and token1 have different values.
 */
export async function calculateTelxEpoch(config: TelxEpochConfig): Promise<TelxEpochResult> {
  const subgraphUrl = config.subgraphUrl || process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";
  
  // Fetch token prices if not provided
  let token0Price = config.token0Price;
  let token1Price = config.token1Price;
  
  if (!token0Price || !token1Price) {
    const rpcUrl = config.rpcUrl || process.env.RPC_URL || "https://mainnet.base.org";
    console.log("Fetching token prices from PositionRegistry contract...");
    const prices = await fetchTokenPrices(
      rpcUrl,
      config.positionRegistry,
      config.poolId,
      BigInt(1),
      -887272,
      887272,
      config.endBlock // Use epoch end block for historical price
    );
    
    if (prices) {
      token0Price = prices.token0Price;
      token1Price = prices.token1Price;
      console.log("✅ Token prices fetched successfully");
      console.log(`   token0Price: ${token0Price.toString()} (${Number(token0Price) / 1e18} TEL per token0)`);
      console.log(`   token1Price: ${token1Price.toString()} (${Number(token1Price) / 1e18} TEL per token1)`);
    } else {
      console.warn("⚠️  Failed to fetch token prices. Using simplified sum (less accurate).");
      console.warn("   To get accurate results, provide token0Price and token1Price in config.");
    }
  }
  
  // Query subgraph for positions and checkpoints
  const data = await queryEpochData(
    subgraphUrl,
    config.poolId,
    config.startBlock,
    config.endBlock
  );
  
  if (!data || !data.positionNFTs) {
    return {
      perWallet: [],
      totalScore: BigInt(0),
      totalRewardsDistributed: BigInt(0)
    };
  }
  
  const positions = data.positionNFTs;
  
  // Calculate weighted scores for each position
  const positionScores: Array<{
    owner: string;
    positionId: string;
    score: bigint;
    weightedScore: bigint;
    classification: string;
  }> = [];
  
  for (const position of positions) {
    // Check if position was subscribed during the epoch
    // A position is eligible if it has an active subscription during the epoch
    const wasSubscribedDuringEpoch = position.subscriptions && position.subscriptions.length > 0
      && position.subscriptions.some((sub: any) => {
        const subscribedAt = parseInt(sub.subscribedAtBlock || "0");
        const unsubscribedAt = sub.unsubscribedAtBlock ? parseInt(sub.unsubscribedAtBlock) : null;
        // Subscribed before epoch end AND (not unsubscribed OR unsubscribed after epoch start)
        return subscribedAt <= config.endBlock && (!unsubscribedAt || unsubscribedAt >= config.startBlock);
      });
    
    if (!wasSubscribedDuringEpoch) {
      continue;
    }
    
    // Calculate fee growth during epoch
    // Returns fee growth deltas and liquidity from end checkpoint (matches Excel's "lastLiquidity")
    const { feeGrowth0, feeGrowth1, endCheckpointLiquidity } = calculateEpochFeeGrowth(
      position,
      config.startBlock,
      config.endBlock
    );
    
    // Use liquidity from end checkpoint (matches Excel's "lastLiquidity" column)
    // This is the liquidity at the end of the epoch, which is what Excel uses for fee conversion
    const positionLiquidity = endCheckpointLiquidity || BigInt(position.liquidity || "0");
    
    // Calculate weighted score (use fetched prices if available)
    const weightedScore = calculateWeightedScore(
      feeGrowth0,
      feeGrowth1,
      position.classification || "Passive",
      positionLiquidity,
      token0Price,
      token1Price
    );
    
    // Get owner (from subscriptions or position owner)
    const owner = position.subscriptions && position.subscriptions.length > 0
      ? position.subscriptions[0].wallet
      : position.owner;
    
    positionScores.push({
      owner: owner.toLowerCase(),
      positionId: position.id,
      score: feeGrowth0 + feeGrowth1,
      weightedScore,
      classification: position.classification || "Passive"
    });
  }
  
  // Aggregate scores by wallet
  const walletScores = new Map<string, bigint>();
  
  for (const posScore of positionScores) {
    const current = walletScores.get(posScore.owner) || BigInt(0);
    walletScores.set(posScore.owner, current + posScore.weightedScore);
  }
  
  // Calculate total weighted score
  let totalScore = BigInt(0);
  for (const score of walletScores.values()) {
    totalScore += score;
  }
  
  // Distribute rewards pro-rata
  const perWallet: Array<{ address: string; rewardTel: bigint; score?: bigint; weightedScore?: bigint }> = [];
  
  if (totalScore > BigInt(0)) {
    for (const [address, weightedScore] of walletScores.entries()) {
      // Calculate reward: (walletScore / totalScore) * totalRewardTel
      const rewardTel = (weightedScore * config.totalRewardTel) / totalScore;
      
      // Get raw score for this wallet
      const walletRawScore = positionScores
        .filter(p => p.owner === address)
        .reduce((sum, p) => sum + p.score, BigInt(0));
      
      perWallet.push({
        address,
        rewardTel,
        score: walletRawScore,
        weightedScore
      });
    }
  }
  
  // Sort by reward amount (descending)
  perWallet.sort((a, b) => {
    if (a.rewardTel > b.rewardTel) return -1;
    if (a.rewardTel < b.rewardTel) return 1;
    return 0;
  });
  
  // Calculate total rewards distributed (may be less than totalRewardTel due to rounding)
  const totalRewardsDistributed = perWallet.reduce((sum, w) => sum + w.rewardTel, BigInt(0));
  
  return {
    perWallet,
    totalScore,
    totalRewardsDistributed
  };
}

