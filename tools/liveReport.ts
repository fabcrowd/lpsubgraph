import fetch from "node-fetch";

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

function formatBigInt(value: string | number): string {
  if (!value) return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === 0) return "0";
  if (num < 0.01) return num.toExponential(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercentage(value: number): string {
  if (isNaN(value) || !isFinite(value)) return "0.00%";
  return `${value.toFixed(2)}%`;
}

export async function generateLiveReport() {
  console.log("=".repeat(100));
  console.log("TELx UNISWAP V4 POOL - LIVE POSITION REPORT");
  console.log("=".repeat(100));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Your Wallet: ${YOUR_WALLET}\n`);

  const data = await querySubgraph(LIVE_REPORT_QUERY);

  if (!data || !data.positionNFTs) {
    console.error("❌ Failed to fetch data from subgraph");
    console.log("\nPossible reasons:");
    console.log("  - Subgraph not deployed yet");
    console.log("  - Subgraph still syncing");
    console.log("  - SUBGRAPH_URL not set correctly");
    console.log("\nSet SUBGRAPH_URL environment variable:");
    console.log('  $env:SUBGRAPH_URL="https://api.studio.thegraph.com/query/.../telx-v4-pool/..."');
    return;
  }

  const positions = data.positionNFTs || [];
  const rewards = data.rewardDistributions || [];

  console.log(`📊 Total Positions: ${positions.length}`);
  console.log(`💰 Total Reward Distributions: ${rewards.length}\n`);

  if (positions.length === 0) {
    console.log("⚠️  No positions found. Subgraph may still be syncing.");
    return;
  }

  // Calculate totals for percentages
  const totalLiquidity = positions.reduce((sum: number, p: any) => sum + parseFloat(p.liquidity || "0"), 0);
  const totalRewards = rewards.reduce((sum: number, r: any) => sum + parseFloat(r.reward || "0"), 0);
  const totalFeeGrowth0 = positions.reduce((sum: number, p: any) => sum + parseFloat(p.totalFeeGrowth0 || "0"), 0);
  const totalFeeGrowth1 = positions.reduce((sum: number, p: any) => sum + parseFloat(p.totalFeeGrowth1 || "0"), 0);

  // Group positions by owner
  const byOwner: { [key: string]: any[] } = {};
  positions.forEach((pos: any) => {
    const owner = pos.owner.toLowerCase();
    if (!byOwner[owner]) {
      byOwner[owner] = [];
    }
    byOwner[owner].push(pos);
  });

  // Calculate owner stats
  const ownerStats = Object.entries(byOwner).map(([owner, ownerPositions]) => {
    const totalLiq = ownerPositions.reduce((sum, p) => sum + parseFloat(p.liquidity || "0"), 0);
    const totalRew = ownerPositions.reduce((sum, p) => sum + parseFloat(p.totalRewardsEarned || "0"), 0);
    const totalFee0 = ownerPositions.reduce((sum, p) => sum + parseFloat(p.totalFeeGrowth0 || "0"), 0);
    const totalFee1 = ownerPositions.reduce((sum, p) => sum + parseFloat(p.totalFeeGrowth1 || "0"), 0);
    
    const passivePositions = ownerPositions.filter((p: any) => p.classification === "Passive");
    const activePositions = ownerPositions.filter((p: any) => p.classification === "Active");
    const jitPositions = ownerPositions.filter((p: any) => p.classification === "JIT");
    
    const subscribedCount = ownerPositions.filter((p: any) => p.isSubscribed).length;
    
    return {
      owner,
      positionCount: ownerPositions.length,
      totalLiquidity: totalLiq,
      totalRewards: totalRew,
      totalFeeGrowth0: totalFee0,
      totalFeeGrowth1: totalFee1,
      passiveCount: passivePositions.length,
      activeCount: activePositions.length,
      jitCount: jitPositions.length,
      subscribedCount,
      positions: ownerPositions,
      liquidityPercent: totalLiquidity > 0 ? (totalLiq / totalLiquidity) * 100 : 0,
      rewardsPercent: totalRewards > 0 ? (totalRew / totalRewards) * 100 : 0,
    };
  });

  // Sort by total liquidity
  ownerStats.sort((a, b) => b.totalLiquidity - a.totalLiquidity);

  // Print comprehensive report
  console.log("=".repeat(100));
  console.log("ALL POSITIONS - DETAILED REPORT");
  console.log("=".repeat(100));
  console.log(`Total Pool Liquidity: ${formatBigInt(totalLiquidity)}`);
  console.log(`Total Rewards Distributed: ${formatBigInt(totalRewards)} TEL`);
  console.log(`Total Fee Growth 0: ${formatBigInt(totalFeeGrowth0)}`);
  console.log(`Total Fee Growth 1: ${formatBigInt(totalFeeGrowth1)}\n`);

  // Table header
  console.log(
    "Position ID".padEnd(12) +
    "Owner".padEnd(44) +
    "Liquidity".padEnd(18) +
    "Liq %".padEnd(10) +
    "Classification".padEnd(15) +
    "Eligible".padEnd(10) +
    "Subscribed".padEnd(12) +
    "Fees 0".padEnd(15) +
    "Fees 1".padEnd(15) +
    "Rewards".padEnd(15) +
    "Reward %"
  );
  console.log("-".repeat(100));

  // Print each position
  positions.forEach((pos: any, idx: number) => {
    const eligibility = calculateRewardEligibility(pos.classification);
    const liqPercent = totalLiquidity > 0 ? (parseFloat(pos.liquidity || "0") / totalLiquidity) * 100 : 0;
    const rewardPercent = totalRewards > 0 ? (parseFloat(pos.totalRewardsEarned || "0") / totalRewards) * 100 : 0;
    const isYours = pos.owner.toLowerCase() === YOUR_WALLET.toLowerCase();
    const marker = isYours ? "★ " : "  ";

    console.log(
      marker + String(pos.id).padEnd(10) +
      String(pos.owner).padEnd(42) +
      formatBigInt(pos.liquidity).padEnd(16) +
      formatPercentage(liqPercent).padEnd(8) +
      pos.classification.padEnd(13) +
      (eligibility.eligible ? "✅ YES" : "❌ NO").padEnd(8) +
      (pos.isSubscribed ? "✅ YES" : "❌ NO").padEnd(10) +
      formatBigInt(pos.totalFeeGrowth0).padEnd(13) +
      formatBigInt(pos.totalFeeGrowth1).padEnd(13) +
      formatBigInt(pos.totalRewardsEarned).padEnd(13) +
      formatPercentage(rewardPercent)
    );
  });

  // Summary by owner
  console.log("\n" + "=".repeat(100));
  console.log("SUMMARY BY WALLET");
  console.log("=".repeat(100));
  console.log(
    "Rank".padEnd(6) +
    "Owner".padEnd(44) +
    "Positions".padEnd(12) +
    "Total Liquidity".padEnd(18) +
    "Liq %".padEnd(10) +
    "Passive".padEnd(10) +
    "Active".padEnd(10) +
    "JIT".padEnd(10) +
    "Subscribed".padEnd(12) +
    "Total Rewards".padEnd(15) +
    "Reward %"
  );
  console.log("-".repeat(100));

  ownerStats.forEach((stats, idx) => {
    const isYours = stats.owner.toLowerCase() === YOUR_WALLET.toLowerCase();
    const marker = isYours ? "★ " : "  ";

    console.log(
      marker + String(idx + 1).padEnd(4) +
      stats.owner.padEnd(42) +
      String(stats.positionCount).padEnd(10) +
      formatBigInt(stats.totalLiquidity).padEnd(16) +
      formatPercentage(stats.liquidityPercent).padEnd(8) +
      String(stats.passiveCount).padEnd(8) +
      String(stats.activeCount).padEnd(8) +
      String(stats.jitCount).padEnd(8) +
      String(stats.subscribedCount).padEnd(10) +
      formatBigInt(stats.totalRewards).padEnd(13) +
      formatPercentage(stats.rewardsPercent)
    );
  });

  // Your positions summary
  const yourStats = ownerStats.find(s => s.owner.toLowerCase() === YOUR_WALLET.toLowerCase());
  if (yourStats) {
    console.log("\n" + "=".repeat(100));
    console.log("YOUR POSITIONS SUMMARY");
    console.log("=".repeat(100));
    console.log(`Total Positions: ${yourStats.positionCount}`);
    console.log(`Total Liquidity: ${formatBigInt(yourStats.totalLiquidity)} (${formatPercentage(yourStats.liquidityPercent)} of pool)`);
    console.log(`Total Rewards Earned: ${formatBigInt(yourStats.totalRewards)} TEL (${formatPercentage(yourStats.rewardsPercent)} of total)`);
    console.log(`Passive Positions: ${yourStats.passiveCount} (${formatPercentage((yourStats.passiveCount / yourStats.positionCount) * 100)} eligible)`);
    console.log(`Active Positions: ${yourStats.activeCount} (0% eligible)`);
    console.log(`JIT Positions: ${yourStats.jitCount} (0% eligible)`);
    console.log(`Subscribed Positions: ${yourStats.subscribedCount}/${yourStats.positionCount}`);
    console.log(`Total Fee Growth 0: ${formatBigInt(yourStats.totalFeeGrowth0)}`);
    console.log(`Total Fee Growth 1: ${formatBigInt(yourStats.totalFeeGrowth1)}`);
  }

  // Eligibility breakdown
  console.log("\n" + "=".repeat(100));
  console.log("REWARDS ELIGIBILITY BREAKDOWN");
  console.log("=".repeat(100));
  const eligibleCount = positions.filter((p: any) => p.classification === "Passive").length;
  const ineligibleCount = positions.length - eligibleCount;
  console.log(`✅ Eligible (Passive): ${eligibleCount} (${formatPercentage((eligibleCount / positions.length) * 100)})`);
  console.log(`❌ Ineligible (Active/JIT): ${ineligibleCount} (${formatPercentage((ineligibleCount / positions.length) * 100)})`);
  console.log(`📊 Total Positions: ${positions.length}`);

  // Subscription status
  console.log("\n" + "=".repeat(100));
  console.log("SUBSCRIPTION STATUS");
  console.log("=".repeat(100));
  const subscribedCount = positions.filter((p: any) => p.isSubscribed).length;
  const unsubscribedCount = positions.length - subscribedCount;
  console.log(`✅ Subscribed: ${subscribedCount} (${formatPercentage((subscribedCount / positions.length) * 100)})`);
  console.log(`❌ Not Subscribed: ${unsubscribedCount} (${formatPercentage((unsubscribedCount / positions.length) * 100)})`);

  console.log("\n" + "=".repeat(100));
  console.log("Report Complete");
  console.log("=".repeat(100));
  console.log("\n★ = Your positions");
  console.log("Run this command regularly to monitor positions in real-time");
}

// CLI
const command = process.argv[2];
if (command === "report" || !command) {
  generateLiveReport();
} else {
  console.log("Usage: npm run query:report");
  console.log("   or: tsx tools/liveReport.ts report");
}

