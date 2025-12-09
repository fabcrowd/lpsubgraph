/**
 * Data layer: Fetches live data from subgraph and returns structured JSON
 */

import fetch from "node-fetch";
import { PoolSummary, PositionSummary, WalletSummary } from "../types";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";
const YOUR_WALLET = "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

/**
 * Fetch current block number from RPC
 */
async function fetchCurrentBlockNumber(): Promise<number | null> {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1
      }),
    });
    const result = await response.json();
    if (result.error) {
      console.warn("Error fetching current block:", result.error.message);
      return null;
    }
    return parseInt(result.result, 16);
  } catch (error) {
    console.warn("Error fetching current block number:", error);
    return null;
  }
}

// Comprehensive query for live report
// We query subscribed positions for the list, but also need total pool liquidity
const LIVE_REPORT_QUERY = `
  query LiveReport($poolId: String!) {
    positionNFTs(
      orderBy: liquidity
      orderDirection: desc
      where: { isSubscribed: true }
    ) {
      id
      owner
      tickLower
      tickUpper
      liquidity
      classification
      isSubscribed
      lifetimeBlocks
      totalFeeGrowth0
      totalFeeGrowth1
      feeGrowthInsidePeriod0
      feeGrowthInsidePeriod1
      modificationCount
      totalRewardsEarned
      createdAtTimestamp
      updatedAtTimestamp
      subscriptions(where: { isActive: true }) {
        wallet
        subscribedAtBlock
        subscribedAtTimestamp
        isActive
      }
    }
    allPositions: positionNFTs(
      where: { pool: $poolId }
      first: 1000
    ) {
      id
      liquidity
    }
    rewardDistributions(
      orderBy: reward
      orderDirection: desc
      first: 100
    ) {
      wallet
      reward
      rewardFormatted
      periodFeesCurrency0Formatted
      periodFeesCurrency1Formatted
      totalFeesCommonDenominator
    }
  }
`;

async function querySubgraph(query: string, variables?: any) {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
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
 * Calculate reward eligibility based on:
 * 1. Classification (Passive/Active/JIT)
 * 2. Subscription start time (must be at least 24 hours ago)
 * 
 * A position is only eligible if:
 * - Classification is "Passive" (100% weight)
 * - At least 24 hours (43200 blocks) have passed since subscription started
 */
function calculateRewardEligibility(
  classification: string,
  subscribedAtBlock?: string,
  currentBlockNumber?: string
): { eligible: boolean; weight: number; reason: string } {
  // First check classification
  if (classification !== "Passive") {
    switch (classification) {
      case "Active":
        return { eligible: false, weight: 0, reason: "Active (0% weight - modified too frequently)" };
      case "JIT":
        return { eligible: false, weight: 0, reason: "JIT (0% weight - same block modifications)" };
      default:
        return { eligible: false, weight: 0, reason: "Unknown classification" };
    }
  }

  // If Passive, check subscription age (24 hour requirement = 43200 blocks)
  if (subscribedAtBlock && currentBlockNumber) {
    const subscribedAt = parseFloat(subscribedAtBlock);
    const currentBlock = parseFloat(currentBlockNumber);
    const blocksSinceSubscription = currentBlock - subscribedAt;
    const MIN_SUBSCRIPTION_AGE_BLOCKS = 43200; // 24 hours on Base

    if (blocksSinceSubscription < MIN_SUBSCRIPTION_AGE_BLOCKS) {
      const blocksRemaining = MIN_SUBSCRIPTION_AGE_BLOCKS - blocksSinceSubscription;
      const hoursRemaining = (blocksRemaining * 12) / 3600; // ~12 seconds per block
      return {
        eligible: false,
        weight: 0,
        reason: `Passive but subscription too new (${hoursRemaining.toFixed(1)}h remaining for 24h requirement)`
      };
    }
  }

  // Passive and subscription is old enough (or no block check available)
  return { eligible: true, weight: 100, reason: "Passive (100% weight)" };
}

/**
 * Fetches live data from subgraph and returns structured PoolSummary
 */
export async function fetchPoolData(): Promise<PoolSummary | null> {
  // Need poolId for the query - get it from config
  const { TELX_BASE_CONFIG } = await import("../../config/telxBasePool");
  const poolId = TELX_BASE_CONFIG.poolId.toLowerCase();
  
  const data = await querySubgraph(LIVE_REPORT_QUERY, { poolId });

  if (!data || !data.positionNFTs) {
    return null;
  }

  const rawPositions = data.positionNFTs || [];
  const rewards = data.rewardDistributions || [];
  const allPositions = data.allPositions || [];

  if (rawPositions.length === 0) {
    return null;
  }

  // Calculate TOTAL pool liquidity from ALL positions (subscribed + unsubscribed)
  // This gives accurate percentages relative to the entire pool
  const totalPoolLiquidity = allPositions.reduce((sum: number, p: any) => sum + parseFloat(p.liquidity || "0"), 0);
  
  // Calculate subscribed liquidity (for display purposes)
  const subscribedLiquidity = rawPositions.reduce((sum: number, p: any) => sum + parseFloat(p.liquidity || "0"), 0);
  
  // Use total pool liquidity for percentage calculations
  const totalLiquidity = totalPoolLiquidity > 0 ? totalPoolLiquidity : subscribedLiquidity;
  const totalRewards = rewards.reduce((sum: number, r: any) => sum + parseFloat(r.reward || "0"), 0);
  const totalFeeGrowth0 = rawPositions.reduce((sum: number, p: any) => sum + parseFloat(p.totalFeeGrowth0 || "0"), 0);
  const totalFeeGrowth1 = rawPositions.reduce((sum: number, p: any) => sum + parseFloat(p.totalFeeGrowth1 || "0"), 0);

  // Get current block number for subscription age check
  const currentBlockNumber = await fetchCurrentBlockNumber();
  const currentBlockStr = currentBlockNumber ? currentBlockNumber.toString() : undefined;

  // Transform positions
  const positions: PositionSummary[] = rawPositions.map((pos: any) => {
    const liqPercent = totalLiquidity > 0 ? (parseFloat(pos.liquidity || "0") / totalLiquidity) * 100 : 0;
    const rewardPercent = totalRewards > 0 ? (parseFloat(pos.totalRewardsEarned || "0") / totalRewards) * 100 : 0;
    
    // Get subscription start block (from first active subscription)
    const subscribedAtBlock = pos.subscriptions && pos.subscriptions.length > 0
      ? pos.subscriptions[0].subscribedAtBlock
      : undefined;
    
    const eligibility = calculateRewardEligibility(
      pos.classification,
      subscribedAtBlock,
      currentBlockStr
    );

    return {
      id: pos.id,
      owner: pos.owner,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: pos.liquidity || "0",
      classification: pos.classification || "Passive",
      isSubscribed: pos.isSubscribed || false,
      lifetimeBlocks: pos.lifetimeBlocks || "0",
      // Keep raw Q128.128 values for calculations (needed for proper epoch scoring)
      totalFeeGrowth0: pos.totalFeeGrowth0 || "0",
      totalFeeGrowth1: pos.totalFeeGrowth1 || "0",
      feeGrowthInsidePeriod0: pos.feeGrowthInsidePeriod0 || "0",
      feeGrowthInsidePeriod1: pos.feeGrowthInsidePeriod1 || "0",
      modificationCount: pos.modificationCount || 0,
      totalRewardsEarned: pos.totalRewardsEarned || "0",
      createdAtTimestamp: pos.createdAtTimestamp || "0",
      updatedAtTimestamp: pos.updatedAtTimestamp || "0",
      liquidityPercent: liqPercent,
      rewardPercent: rewardPercent,
      eligibility: eligibility,
    };
  });

  // Group positions by owner
  const byOwner: { [key: string]: PositionSummary[] } = {};
  positions.forEach((pos) => {
    const owner = pos.owner.toLowerCase();
    if (!byOwner[owner]) {
      byOwner[owner] = [];
    }
    byOwner[owner].push(pos);
  });

  // Calculate wallet stats
  const wallets: WalletSummary[] = Object.entries(byOwner).map(([owner, ownerPositions]) => {
    const totalLiq = ownerPositions.reduce((sum, p) => sum + parseFloat(p.liquidity || "0"), 0);
    const totalRew = ownerPositions.reduce((sum, p) => sum + parseFloat(p.totalRewardsEarned || "0"), 0);
    const totalFee0 = ownerPositions.reduce((sum, p) => sum + parseFloat(p.totalFeeGrowth0 || "0"), 0);
    const totalFee1 = ownerPositions.reduce((sum, p) => sum + parseFloat(p.totalFeeGrowth1 || "0"), 0);
    
    const passivePositions = ownerPositions.filter((p) => p.classification === "Passive");
    const activePositions = ownerPositions.filter((p) => p.classification === "Active");
    const jitPositions = ownerPositions.filter((p) => p.classification === "JIT");
    const subscribedCount = ownerPositions.filter((p) => p.isSubscribed).length;
    
    return {
      wallet: owner,
      positionCount: ownerPositions.length,
      totalLiquidity: totalLiq,
      totalRewards: totalRew,
      totalFeeGrowth0: totalFee0,
      totalFeeGrowth1: totalFee1,
      passiveCount: passivePositions.length,
      activeCount: activePositions.length,
      jitCount: jitPositions.length,
      subscribedCount,
      liquidityPercent: totalLiquidity > 0 ? (totalLiq / totalLiquidity) * 100 : 0,
      rewardsPercent: totalRewards > 0 ? (totalRew / totalRewards) * 100 : 0,
      positions: ownerPositions,
    };
  });

  // Sort wallets by total liquidity
  wallets.sort((a, b) => b.totalLiquidity - a.totalLiquidity);

  // Calculate eligibility breakdown
  const eligibleCount = positions.filter((p) => p.classification === "Passive").length;
  const ineligibleCount = positions.length - eligibleCount;
  const subscribedCount = positions.filter((p) => p.isSubscribed).length;
  const unsubscribedCount = positions.length - subscribedCount;

  return {
    totalPositions: positions.length,
    totalLiquidity, // Total pool liquidity (all positions)
    subscribedLiquidity, // Subscribed positions only
    totalRewards,
    totalFeeGrowth0,
    totalFeeGrowth1,
    totalRewardDistributions: rewards.length,
    eligibleCount,
    ineligibleCount,
    eligiblePercent: positions.length > 0 ? (eligibleCount / positions.length) * 100 : 0,
    subscribedCount,
    unsubscribedCount,
    subscribedPercent: positions.length > 0 ? (subscribedCount / positions.length) * 100 : 0,
    positions,
    wallets,
    generatedAt: new Date().toISOString(),
    subgraphUrl: SUBGRAPH_URL,
    yourWallet: YOUR_WALLET,
  };
}

