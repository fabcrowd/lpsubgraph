/**
 * Core data model types for TELx strategy engine
 */

export interface PositionSummary {
  id: string;
  owner: string;
  tickLower: string;
  tickUpper: string;
  liquidity: string;
  classification: "JIT" | "Active" | "Passive";
  isSubscribed: boolean;
  lifetimeBlocks: string;
  totalFeeGrowth0: string;
  totalFeeGrowth1: string;
  feeGrowthInsidePeriod0: string;
  feeGrowthInsidePeriod1: string;
  modificationCount: number;
  totalRewardsEarned: string;
  createdAtTimestamp: string;
  updatedAtTimestamp: string;
  
  // Computed metrics
  liquidityPercent: number;
  rewardPercent: number;
  eligibility: {
    eligible: boolean;
    weight: number;
    reason: string;
  };
  
  // APR metrics (computed by metrics layer)
  feeAPR?: number;
  rewardAPR?: number;
  totalExpectedAPR?: number;
}

export interface WalletSummary {
  wallet: string;
  positionCount: number;
  totalLiquidity: number;
  totalRewards: number;
  totalFeeGrowth0: number;
  totalFeeGrowth1: number;
  passiveCount: number;
  activeCount: number;
  jitCount: number;
  subscribedCount: number;
  liquidityPercent: number;
  rewardsPercent: number;
  positions: PositionSummary[];
  
  // APR metrics (aggregated)
  averageFeeAPR?: number;
  averageRewardAPR?: number;
  averageTotalAPR?: number;
  weightedAverageFeeAPR?: number;
  weightedAverageRewardAPR?: number;
  weightedAverageTotalAPR?: number;
  
  // Live epoch reward metrics
  liveRewardTelSoFar?: bigint;
  liveRewardShare?: number;        // 0..1
  liveRewardSharePercent?: number; // 0..100
}

export interface PoolSummary {
  totalPositions: number;
  totalLiquidity: number; // Total pool liquidity (all positions)
  subscribedLiquidity?: number; // Subscribed positions only
  totalRewards: number;
  totalFeeGrowth0: number;
  totalFeeGrowth1: number;
  totalRewardDistributions: number;
  
  // Eligibility breakdown
  eligibleCount: number;
  ineligibleCount: number;
  eligiblePercent: number;
  
  // Subscription breakdown
  subscribedCount: number;
  unsubscribedCount: number;
  subscribedPercent: number;
  
  // Positions and wallets
  positions: PositionSummary[];
  wallets: WalletSummary[];
  
  // Metadata
  generatedAt: string;
  subgraphUrl: string;
  yourWallet?: string;
}

