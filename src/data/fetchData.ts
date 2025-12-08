/**
 * Data layer: Fetches live data from subgraph and returns structured JSON
 */

import fetch from "node-fetch";
import { PoolSummary, PositionSummary, WalletSummary } from "../types";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";
const YOUR_WALLET = "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445";

// Comprehensive query for live report
const LIVE_REPORT_QUERY = `
  query LiveReport {
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
        subscribedAtTimestamp
        isActive
      }
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

function calculateRewardEligibility(classification: string): { eligible: boolean; weight: number; reason: string } {
  switch (classification) {
    case "Passive":
      return { eligible: true, weight: 100, reason: "Passive (100% weight)" };
    case "Active":
      return { eligible: false, weight: 0, reason: "Active (0% weight - modified too frequently)" };
    case "JIT":
      return { eligible: false, weight: 0, reason: "JIT (0% weight - same block modifications)" };
    default:
      return { eligible: false, weight: 0, reason: "Unknown classification" };
  }
}

/**
 * Fetches live data from subgraph and returns structured PoolSummary
 */
export async function fetchPoolData(): Promise<PoolSummary | null> {
  const data = await querySubgraph(LIVE_REPORT_QUERY);

  if (!data || !data.positionNFTs) {
    return null;
  }

  const rawPositions = data.positionNFTs || [];
  const rewards = data.rewardDistributions || [];

  if (rawPositions.length === 0) {
    return null;
  }

  // Calculate totals for percentages
  const totalLiquidity = rawPositions.reduce((sum: number, p: any) => sum + parseFloat(p.liquidity || "0"), 0);
  const totalRewards = rewards.reduce((sum: number, r: any) => sum + parseFloat(r.reward || "0"), 0);
  const totalFeeGrowth0 = rawPositions.reduce((sum: number, p: any) => sum + parseFloat(p.totalFeeGrowth0 || "0"), 0);
  const totalFeeGrowth1 = rawPositions.reduce((sum: number, p: any) => sum + parseFloat(p.totalFeeGrowth1 || "0"), 0);

  // Transform positions
  const positions: PositionSummary[] = rawPositions.map((pos: any) => {
    const liqPercent = totalLiquidity > 0 ? (parseFloat(pos.liquidity || "0") / totalLiquidity) * 100 : 0;
    const rewardPercent = totalRewards > 0 ? (parseFloat(pos.totalRewardsEarned || "0") / totalRewards) * 100 : 0;
    const eligibility = calculateRewardEligibility(pos.classification);

    return {
      id: pos.id,
      owner: pos.owner,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: pos.liquidity || "0",
      classification: pos.classification || "Passive",
      isSubscribed: pos.isSubscribed || false,
      lifetimeBlocks: pos.lifetimeBlocks || "0",
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
    totalLiquidity,
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

