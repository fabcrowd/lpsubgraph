/**
 * Metrics layer: Computes APR estimates for positions and wallets
 */

import { PositionSummary, WalletSummary, PoolSummary } from "../types";

// Constants for APR calculations
const BLOCKS_PER_YEAR = 2628000; // ~12 seconds per block on Base, 365 days
const SECONDS_PER_YEAR = 31536000;

/**
 * Calculate fee APR for a position based on fee growth and lifetime
 * 
 * APR = (Fee Growth / Lifetime Blocks) * (Blocks Per Year / Position Liquidity) * 100
 * 
 * This is a simplified estimate. Real APR would need:
 * - Token prices
 * - Position value in USD
 * - More sophisticated fee growth calculations
 */
export function calculateFeeAPR(position: PositionSummary): number {
  if (!position.lifetimeBlocks || parseFloat(position.lifetimeBlocks) === 0) {
    return 0;
  }

  const lifetimeBlocks = parseFloat(position.lifetimeBlocks);
  const liquidity = parseFloat(position.liquidity);
  
  if (liquidity === 0 || lifetimeBlocks === 0) {
    return 0;
  }

  // Calculate fee growth per block
  const feeGrowth0 = parseFloat(position.totalFeeGrowth0 || "0");
  const feeGrowth1 = parseFloat(position.totalFeeGrowth1 || "0");
  
  // For now, we'll use a simplified calculation
  // In reality, you'd need token prices to convert to USD and calculate proper APR
  // This is a placeholder that estimates APR based on fee growth rate
  
  // Estimate: fee growth per block * blocks per year / liquidity
  // This is a rough approximation - actual calculation would need token prices
  const feeGrowthPerBlock = (feeGrowth0 + feeGrowth1) / lifetimeBlocks;
  const annualFeeGrowth = feeGrowthPerBlock * BLOCKS_PER_YEAR;
  
  // Convert to percentage (this is simplified - real calculation needs position value)
  // For now, return a placeholder that scales with fee growth
  const aprEstimate = (annualFeeGrowth / liquidity) * 100;
  
  // Cap at reasonable values (this is a placeholder calculation)
  return Math.min(Math.max(aprEstimate, 0), 1000); // Cap at 1000% APR
}

/**
 * Calculate reward APR placeholder
 * 
 * This is a stub that will be wired to real TELx scoring later.
 * For now, returns 0 or a placeholder value based on eligibility.
 */
export function calculateRewardAPR(position: PositionSummary, poolSummary: PoolSummary): number {
  // Placeholder: If eligible and subscribed, estimate reward APR
  // Real implementation would:
  // - Calculate expected rewards based on position's share of pool
  // - Factor in classification weight (Passive = 100%, Active/JIT = 0%)
  // - Use actual reward distribution data
  
  if (!position.isSubscribed || !position.eligibility.eligible) {
    return 0;
  }

  // Placeholder calculation: estimate based on total rewards and position share
  if (poolSummary.totalRewards === 0 || poolSummary.totalLiquidity === 0) {
    return 0;
  }

  const positionLiquidity = parseFloat(position.liquidity);
  const positionShare = positionLiquidity / poolSummary.totalLiquidity;
  const estimatedAnnualRewards = poolSummary.totalRewards * positionShare * 52; // Assume weekly epochs
  
  // Estimate APR (this is a placeholder - needs actual reward schedule)
  // For now, return a placeholder value
  const rewardAPREstimate = (estimatedAnnualRewards / positionLiquidity) * 100;
  
  return Math.min(Math.max(rewardAPREstimate, 0), 1000); // Cap at 1000% APR
}

/**
 * Calculate total expected APR (fee APR + reward APR)
 */
export function calculateTotalAPR(position: PositionSummary, poolSummary: PoolSummary): number {
  const feeAPR = calculateFeeAPR(position);
  const rewardAPR = calculateRewardAPR(position, poolSummary);
  return feeAPR + rewardAPR;
}

/**
 * Add APR metrics to a position
 */
export function enrichPositionWithAPR(position: PositionSummary, poolSummary: PoolSummary): PositionSummary {
  return {
    ...position,
    feeAPR: calculateFeeAPR(position),
    rewardAPR: calculateRewardAPR(position, poolSummary),
    totalExpectedAPR: calculateTotalAPR(position, poolSummary),
  };
}

/**
 * Calculate aggregated APR metrics for a wallet
 */
export function calculateWalletAPR(wallet: WalletSummary, poolSummary: PoolSummary): WalletSummary {
  const positionsWithAPR = wallet.positions.map(p => enrichPositionWithAPR(p, poolSummary));
  
  // Calculate averages
  const totalFeeAPR = positionsWithAPR.reduce((sum, p) => sum + (p.feeAPR || 0), 0);
  const totalRewardAPR = positionsWithAPR.reduce((sum, p) => sum + (p.rewardAPR || 0), 0);
  const totalExpectedAPR = positionsWithAPR.reduce((sum, p) => sum + (p.totalExpectedAPR || 0), 0);
  
  const avgFeeAPR = positionsWithAPR.length > 0 ? totalFeeAPR / positionsWithAPR.length : 0;
  const avgRewardAPR = positionsWithAPR.length > 0 ? totalRewardAPR / positionsWithAPR.length : 0;
  const avgTotalAPR = positionsWithAPR.length > 0 ? totalExpectedAPR / positionsWithAPR.length : 0;
  
  // Calculate liquidity-weighted averages
  const totalLiq = wallet.totalLiquidity;
  let weightedFeeAPR = 0;
  let weightedRewardAPR = 0;
  let weightedTotalAPR = 0;
  
  if (totalLiq > 0) {
    positionsWithAPR.forEach(p => {
      const weight = parseFloat(p.liquidity) / totalLiq;
      weightedFeeAPR += (p.feeAPR || 0) * weight;
      weightedRewardAPR += (p.rewardAPR || 0) * weight;
      weightedTotalAPR += (p.totalExpectedAPR || 0) * weight;
    });
  }
  
  return {
    ...wallet,
    positions: positionsWithAPR,
    averageFeeAPR: avgFeeAPR,
    averageRewardAPR: avgRewardAPR,
    averageTotalAPR: avgTotalAPR,
    weightedAverageFeeAPR: weightedFeeAPR,
    weightedAverageRewardAPR: weightedRewardAPR,
    weightedAverageTotalAPR: weightedTotalAPR,
  };
}

/**
 * Add APR metrics to all positions and wallets in pool summary
 */
export function enrichPoolSummaryWithAPR(poolSummary: PoolSummary): PoolSummary {
  // Enrich positions with APR
  const positionsWithAPR = poolSummary.positions.map(p => enrichPositionWithAPR(p, poolSummary));
  
  // Enrich wallets with APR
  const walletsWithAPR = poolSummary.wallets.map(w => {
    // Update wallet positions to use enriched positions
    const walletPositions = positionsWithAPR.filter(p => 
      p.owner.toLowerCase() === w.wallet.toLowerCase()
    );
    const walletWithUpdatedPositions = { ...w, positions: walletPositions };
    return calculateWalletAPR(walletWithUpdatedPositions, poolSummary);
  });
  
  return {
    ...poolSummary,
    positions: positionsWithAPR,
    wallets: walletsWithAPR,
  };
}

