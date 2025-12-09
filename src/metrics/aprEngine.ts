/**
 * Metrics layer: Computes APR estimates for positions and wallets
 */

import { PositionSummary, WalletSummary, PoolSummary } from "../types";

// Constants for APR calculations
const BLOCKS_PER_YEAR = 2628000; // ~12 seconds per block on Base, 365 days
const SECONDS_PER_YEAR = 31536000;

/**
 * Convert fee growth from Q128.128 format to actual token amounts
 * 
 * Fee growth in Uniswap v4 is stored as Q128.128 (scaled by 2^128).
 * To get actual fees: (feeGrowth * liquidity) / 2^128
 */
function convertFeeGrowthToAmount(feeGrowth: string, liquidity: string): number {
  const Q128 = Math.pow(2, 128);
  const feeGrowthNum = parseFloat(feeGrowth || "0");
  const liquidityNum = parseFloat(liquidity || "0");
  
  if (feeGrowthNum === 0 || liquidityNum === 0) {
    return 0;
  }
  
  // Actual fees = (feeGrowth * liquidity) / 2^128
  // Note: This gives fees in token units, not USD
  return (feeGrowthNum * liquidityNum) / Q128;
}

/**
 * Calculate fee APR for a position based on fee growth and lifetime
 * 
 * IMPORTANT: Fee growth is in Q128.128 format and must be converted to actual amounts first.
 * 
 * APR calculation:
 * 1. Convert fee growth to actual token amounts
 * 2. Calculate fees per block
 * 3. Project to annual fees
 * 4. Calculate APR as percentage
 * 
 * NOTE: This is a simplified estimate. Real APR would need:
 * - Token prices to convert to USD
 * - Position value in USD
 * - More sophisticated fee growth calculations
 * 
 * Uses period-specific fee growth if available, otherwise falls back to total fee growth.
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

  // Prefer period-specific fee growth if available (more accurate for recent performance)
  // Otherwise use total fee growth (cumulative since position creation)
  const feeGrowth0 = position.feeGrowthInsidePeriod0 || position.totalFeeGrowth0 || "0";
  const feeGrowth1 = position.feeGrowthInsidePeriod1 || position.totalFeeGrowth1 || "0";
  
  // Convert fee growth from Q128.128 format to actual token amounts
  const fee0Amount = convertFeeGrowthToAmount(feeGrowth0, position.liquidity || "0");
  const fee1Amount = convertFeeGrowthToAmount(feeGrowth1, position.liquidity || "0");
  
  // Calculate total fees earned
  const totalFees = fee0Amount + fee1Amount;
  
  // If fees are extremely small, return 0 (likely position is new or inactive)
  if (totalFees < 1e-15) {
    return 0;
  }
  
  // Calculate fees per block
  const feesPerBlock = totalFees / lifetimeBlocks;
  
  // Project to annual fees
  const annualFees = feesPerBlock * BLOCKS_PER_YEAR;
  
  // For APR calculation, we need to estimate position value
  // Since we don't have token prices, we'll use a simplified approach:
  // Assume liquidity roughly represents position value (this is approximate)
  // In Uniswap v4, liquidity = sqrt(price) * amount, so this is not exact
  // But for a rough estimate, we can use it
  
  // Calculate APR as percentage
  // Note: This is a simplified estimate - real APR needs token prices for accurate calculation
  const aprEstimate = liquidity > 0 ? (annualFees / liquidity) * 100 : 0;
  
  // Cap at reasonable values and ensure minimum precision
  const cappedAPR = Math.min(Math.max(aprEstimate, 0), 1000);
  
  // Round to 2 decimal places, but if very small (< 0.01%), return 0
  return cappedAPR < 0.01 ? 0 : Math.round(cappedAPR * 100) / 100;
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

