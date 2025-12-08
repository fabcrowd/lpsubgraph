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
 * Query subgraph for positions and checkpoints in epoch range
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
          isSubscribed: true
        }
      ) {
        id
        owner
        liquidity
        classification
        isSubscribed
        createdAtBlock
        updatedAtBlock
        feeGrowthInsidePeriod0
        feeGrowthInsidePeriod1
        checkpoints(
          where: {
            blockNumber_gte: $startBlock
            blockNumber_lte: $endBlock
          }
          orderBy: blockNumber
          orderByDirection: asc
        ) {
          id
          blockNumber
          timestamp
          feeGrowthInside0LastX128
          feeGrowthInside1LastX128
          liquidity
        }
        subscriptions(where: { isActive: true }) {
          wallet
          subscribedAtBlock
          subscribedAtTimestamp
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
 * If no checkpoints exist, uses feeGrowthInsidePeriod0/1 from the position.
 */
function calculateEpochFeeGrowth(
  position: any,
  startBlock: number,
  endBlock: number
): { feeGrowth0: bigint; feeGrowth1: bigint } {
  const checkpoints = position.checkpoints || [];
  
  // If we have checkpoints, calculate delta
  if (checkpoints.length > 0) {
    // Find checkpoint at or before startBlock
    let startCheckpoint = null;
    for (let i = checkpoints.length - 1; i >= 0; i--) {
      if (parseInt(checkpoints[i].blockNumber) <= startBlock) {
        startCheckpoint = checkpoints[i];
        break;
      }
    }
    
    // Find checkpoint at or before endBlock
    let endCheckpoint = null;
    for (let i = checkpoints.length - 1; i >= 0; i--) {
      if (parseInt(checkpoints[i].blockNumber) <= endBlock) {
        endCheckpoint = checkpoints[i];
        break;
      }
    }
    
    // If we have both, calculate delta
    if (startCheckpoint && endCheckpoint) {
      const feeGrowth0Delta = BigInt(endCheckpoint.feeGrowthInside0LastX128) - BigInt(startCheckpoint.feeGrowthInside0LastX128);
      const feeGrowth1Delta = BigInt(endCheckpoint.feeGrowthInside1LastX128) - BigInt(startCheckpoint.feeGrowthInside1LastX128);
      return { feeGrowth0: feeGrowth0Delta, feeGrowth1: feeGrowth1Delta };
    }
    
    // If we only have end checkpoint, use it (assuming start was 0)
    if (endCheckpoint) {
      return {
        feeGrowth0: BigInt(endCheckpoint.feeGrowthInside0LastX128),
        feeGrowth1: BigInt(endCheckpoint.feeGrowthInside1LastX128)
      };
    }
  }
  
  // Fallback: use feeGrowthInsidePeriod0/1 if available
  // This is less accurate but works if checkpoints aren't available
  return {
    feeGrowth0: BigInt(position.feeGrowthInsidePeriod0 || "0"),
    feeGrowth1: BigInt(position.feeGrowthInsidePeriod1 || "0")
  };
}

/**
 * Calculate weighted score for a position
 * 
 * Score = (feeGrowth0 + feeGrowth1) * classification_weight
 * 
 * For now, we use a simplified approach: sum both fee growths.
 * In production, you'd need token prices to convert to a common denominator.
 */
function calculateWeightedScore(
  feeGrowth0: bigint,
  feeGrowth1: bigint,
  classification: string
): bigint {
  const weight = getClassificationWeight(classification);
  
  // Simplified: sum fee growths (in production, convert to common denominator using prices)
  const totalFeeGrowth = feeGrowth0 + feeGrowth1;
  
  // Apply weight (weight is 0-100, so divide by 100)
  const weightedScore = (totalFeeGrowth * BigInt(weight)) / BigInt(100);
  
  return weightedScore;
}

/**
 * Calculate TELx epoch rewards
 * 
 * This implements the canonical TELx scoring logic:
 * 1. Fetch all subscribed positions for the pool
 * 2. Calculate fee growth during epoch for each position
 * 3. Apply classification weights (JIT=0%, Active=0%, Passive=100%)
 * 4. Compute weighted scores
 * 5. Distribute rewards pro-rata based on weighted scores
 */
export async function calculateTelxEpoch(config: TelxEpochConfig): Promise<TelxEpochResult> {
  const subgraphUrl = config.subgraphUrl || process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";
  
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
    // Only process subscribed positions
    if (!position.isSubscribed) {
      continue;
    }
    
    // Calculate fee growth during epoch
    const { feeGrowth0, feeGrowth1 } = calculateEpochFeeGrowth(
      position,
      config.startBlock,
      config.endBlock
    );
    
    // Calculate weighted score
    const weightedScore = calculateWeightedScore(
      feeGrowth0,
      feeGrowth1,
      position.classification || "Passive"
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

