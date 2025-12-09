/**
 * Reporting layer: Plain text CLI output
 * 
 * This is the original report format, refactored to use structured data
 */

import { PoolSummary, PositionSummary, WalletSummary } from "../types";

function formatBigInt(value: string | number): string {
  if (!value) return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === 0) return "0";
  if (num < 0.01) return num.toExponential(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Convert fee growth from Q128.128 format to actual token amounts for display
 * Fee growth is scaled by 2^128, so actual fees = (feeGrowth * liquidity) / 2^128
 */
function convertFeeGrowthForDisplay(feeGrowth: string, liquidity: string): number {
  const Q128 = Math.pow(2, 128);
  const feeGrowthNum = parseFloat(feeGrowth || "0");
  const liquidityNum = parseFloat(liquidity || "0");
  
  if (feeGrowthNum === 0 || liquidityNum === 0) {
    return 0;
  }
  
  // Actual fees = (feeGrowth * liquidity) / 2^128
  return (feeGrowthNum * liquidityNum) / Q128;
}

function formatPercentage(value: number): string {
  if (isNaN(value) || !isFinite(value)) return "0.00%";
  return `${value.toFixed(2)}%`;
}

function formatTel(value: bigint | undefined): string {
  if (!value || value === BigInt(0)) return "0";
  // TEL has 18 decimals
  const telAmount = Number(value) / 1e18;
  if (telAmount < 0.01) return telAmount.toExponential(2);
  return telAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Generate and print plain text report
 */
export function generateTextReport(poolSummary: PoolSummary): void {
  console.log("=".repeat(100));
  console.log("TELx UNISWAP V4 POOL - LIVE POSITION REPORT");
  console.log("=".repeat(100));
  console.log(`Generated: ${poolSummary.generatedAt}`);
  console.log(`Your Wallet: ${poolSummary.yourWallet || "Not set"}\n`);

  console.log(`📊 Total Positions: ${poolSummary.totalPositions}`);
  console.log(`💰 Total Reward Distributions: ${poolSummary.totalRewardDistributions}\n`);

  if (poolSummary.totalPositions === 0) {
    console.log("⚠️  No positions found. Subgraph may still be syncing.");
    return;
  }

  // Print comprehensive report
  console.log("=".repeat(100));
  console.log("ALL POSITIONS - DETAILED REPORT");
  console.log("=".repeat(100));
  console.log(`Total Pool Liquidity (All Positions): ${formatBigInt(poolSummary.totalLiquidity)}`);
  if (poolSummary.subscribedLiquidity !== undefined) {
    const subscribedPercent = poolSummary.totalLiquidity > 0 
      ? (poolSummary.subscribedLiquidity / poolSummary.totalLiquidity * 100).toFixed(2)
      : "0.00";
    console.log(`Subscribed Liquidity: ${formatBigInt(poolSummary.subscribedLiquidity)} (${subscribedPercent}% of total)`);
  }
  console.log(`Total Rewards Distributed: ${formatBigInt(poolSummary.totalRewards)} TEL`);
  
  // Convert total fee growth for display (approximate - using average liquidity)
  const avgLiquidity = poolSummary.totalPositions > 0 ? poolSummary.totalLiquidity / poolSummary.totalPositions : 0;
  const totalFee0Converted = poolSummary.totalPositions > 0 
    ? convertFeeGrowthForDisplay(poolSummary.totalFeeGrowth0.toString(), avgLiquidity.toString()) * poolSummary.totalPositions
    : 0;
  const totalFee1Converted = poolSummary.totalPositions > 0
    ? convertFeeGrowthForDisplay(poolSummary.totalFeeGrowth1.toString(), avgLiquidity.toString()) * poolSummary.totalPositions
    : 0;
  
  console.log(`Total Fees 0 (converted): ${formatBigInt(totalFee0Converted)}`);
  console.log(`Total Fees 1 (converted): ${formatBigInt(totalFee1Converted)}`);
  console.log(`Note: Fee values shown are converted from Q128.128 format`);
  console.log(`Note: APR calculations are approximate without token prices for accurate USD conversion\n`);

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
    "Reward %".padEnd(12) +
    "Fee APR".padEnd(10) +
    "Reward APR".padEnd(12) +
    "Total APR"
  );
  console.log("-".repeat(100));

  // Print each position
  poolSummary.positions.forEach((pos) => {
    const isYours = poolSummary.yourWallet && pos.owner.toLowerCase() === poolSummary.yourWallet.toLowerCase();
    const marker = isYours ? "★ " : "  ";

    console.log(
      marker + String(pos.id).padEnd(10) +
      String(pos.owner).padEnd(42) +
      formatBigInt(pos.liquidity).padEnd(16) +
      formatPercentage(pos.liquidityPercent).padEnd(8) +
      pos.classification.padEnd(13) +
      (pos.eligibility.eligible ? "✅ YES" : "❌ NO").padEnd(8) +
      (pos.isSubscribed ? "✅ YES" : "❌ NO").padEnd(10) +
      formatBigInt(convertFeeGrowthForDisplay(pos.totalFeeGrowth0, pos.liquidity)).padEnd(13) +
      formatBigInt(convertFeeGrowthForDisplay(pos.totalFeeGrowth1, pos.liquidity)).padEnd(13) +
      formatBigInt(pos.totalRewardsEarned).padEnd(13) +
      formatPercentage(pos.rewardPercent).padEnd(10) +
      formatPercentage(pos.feeAPR || 0).padEnd(8) +
      formatPercentage(pos.rewardAPR || 0).padEnd(10) +
      formatPercentage(pos.totalExpectedAPR || 0)
    );
  });

  // Summary by wallet
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
    "Reward %".padEnd(12) +
    "Live Reward TEL".padEnd(18) +
    "Live Reward %"
  );
  console.log("-".repeat(100));

  poolSummary.wallets.forEach((stats, idx) => {
    const isYours = poolSummary.yourWallet && stats.wallet.toLowerCase() === poolSummary.yourWallet.toLowerCase();
    const marker = isYours ? "★ " : "  ";

    console.log(
      marker + String(idx + 1).padEnd(4) +
      stats.wallet.padEnd(42) +
      String(stats.positionCount).padEnd(10) +
      formatBigInt(stats.totalLiquidity).padEnd(16) +
      formatPercentage(stats.liquidityPercent).padEnd(8) +
      String(stats.passiveCount).padEnd(8) +
      String(stats.activeCount).padEnd(8) +
      String(stats.jitCount).padEnd(8) +
      String(stats.subscribedCount).padEnd(10) +
      formatBigInt(stats.totalRewards).padEnd(13) +
      formatPercentage(stats.rewardsPercent).padEnd(10) +
      formatTel(stats.liveRewardTelSoFar).padEnd(16) +
      formatPercentage(stats.liveRewardSharePercent || 0)
    );
  });

  // Your positions summary
  const yourStats = poolSummary.wallets.find(s => 
    poolSummary.yourWallet && s.wallet.toLowerCase() === poolSummary.yourWallet.toLowerCase()
  );
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
    
    // Convert total fee growth for display (approximate using average liquidity)
    const yourAvgLiquidity = yourStats.positionCount > 0 ? yourStats.totalLiquidity / yourStats.positionCount : 0;
    const yourFee0Converted = yourStats.positionCount > 0
      ? convertFeeGrowthForDisplay(yourStats.totalFeeGrowth0.toString(), yourAvgLiquidity.toString()) * yourStats.positionCount
      : 0;
    const yourFee1Converted = yourStats.positionCount > 0
      ? convertFeeGrowthForDisplay(yourStats.totalFeeGrowth1.toString(), yourAvgLiquidity.toString()) * yourStats.positionCount
      : 0;
    
    console.log(`Total Fees 0 (converted): ${formatBigInt(yourFee0Converted)}`);
    console.log(`Total Fees 1 (converted): ${formatBigInt(yourFee1Converted)}`);
    console.log(`Note: Fee values are converted from Q128.128 format`);
    if (yourStats.averageFeeAPR !== undefined) {
      console.log(`Average Fee APR: ${formatPercentage(yourStats.averageFeeAPR)}`);
    }
    if (yourStats.averageRewardAPR !== undefined) {
      console.log(`Average Reward APR: ${formatPercentage(yourStats.averageRewardAPR)}`);
    }
    if (yourStats.averageTotalAPR !== undefined) {
      console.log(`Average Total APR: ${formatPercentage(yourStats.averageTotalAPR)}`);
    }
    // Live epoch rewards
    if (yourStats.liveRewardTelSoFar !== undefined && yourStats.liveRewardTelSoFar > BigInt(0)) {
      console.log(`Live Epoch Rewards (So Far): ${formatTel(yourStats.liveRewardTelSoFar)} TEL (${formatPercentage(yourStats.liveRewardSharePercent || 0)} of epoch if ended now)`);
    }
  }

  // Eligibility breakdown
  console.log("\n" + "=".repeat(100));
  console.log("REWARDS ELIGIBILITY BREAKDOWN");
  console.log("=".repeat(100));
  console.log(`✅ Eligible (Passive): ${poolSummary.eligibleCount} (${formatPercentage(poolSummary.eligiblePercent)})`);
  console.log(`❌ Ineligible (Active/JIT): ${poolSummary.ineligibleCount} (${formatPercentage(100 - poolSummary.eligiblePercent)})`);
  console.log(`📊 Total Positions: ${poolSummary.totalPositions}`);

  // Subscription status
  console.log("\n" + "=".repeat(100));
  console.log("SUBSCRIPTION STATUS");
  console.log("=".repeat(100));
  console.log(`✅ Subscribed: ${poolSummary.subscribedCount} (${formatPercentage(poolSummary.subscribedPercent)})`);
  console.log(`❌ Not Subscribed: ${poolSummary.unsubscribedCount} (${formatPercentage(100 - poolSummary.subscribedPercent)})`);

  console.log("\n" + "=".repeat(100));
  console.log("Report Complete");
  console.log("=".repeat(100));
  console.log("\n★ = Your positions");
  console.log("Run this command regularly to monitor positions in real-time");
}

