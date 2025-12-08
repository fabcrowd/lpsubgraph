import fetch from "node-fetch";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";
const YOUR_WALLET = "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445";

// Query to get all positions with performance metrics
const ALL_POSITIONS_QUERY = `
  query GetAllPositions {
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
      }
    }
  }
`;

// Query to compare your positions vs competitors
const COMPETITIVE_ANALYSIS_QUERY = `
  query CompetitiveAnalysis($yourWallet: Bytes!) {
    yourPositions: positionNFTs(
      where: { 
        subscriptions_: { 
          wallet: $yourWallet
          isActive: true
        }
      }
    ) {
      id
      owner
      tickLower
      tickUpper
      liquidity
      classification
      lifetimeBlocks
      totalFeeGrowth0
      totalFeeGrowth1
      feeGrowthInsidePeriod0
      feeGrowthInsidePeriod1
      modificationCount
      totalRewardsEarned
      createdAtTimestamp
      updatedAtTimestamp
    }
    
    competitorPositions: positionNFTs(
      where: { 
        isSubscribed: true
        owner_not: $yourWallet
      }
      orderBy: liquidity
      orderDirection: desc
      first: 50
    ) {
      id
      owner
      tickLower
      tickUpper
      liquidity
      classification
      lifetimeBlocks
      totalFeeGrowth0
      totalFeeGrowth1
      feeGrowthInsidePeriod0
      feeGrowthInsidePeriod1
      modificationCount
      totalRewardsEarned
      createdAtTimestamp
      updatedAtTimestamp
    }
  }
`;

// Query to get reward distributions for an epoch
const EPOCH_REWARDS_QUERY = `
  query GetEpochRewards($epoch: BigInt!) {
    rewardDistributions(
      where: { epoch: $epoch }
      orderBy: reward
      orderDirection: desc
    ) {
      id
      wallet
      reward
      rewardFormatted
      periodFeesCurrency0
      periodFeesCurrency0Formatted
      periodFeesCurrency1
      periodFeesCurrency1Formatted
      totalFeesCommonDenominator
      distributedAtTimestamp
      positionRewards {
        position {
          id
          tickLower
          tickUpper
          liquidity
          classification
        }
        feeGrowthDuringEpoch
        weightedScore
        classification
      }
    }
  }
`;

// Query to get position performance over time
const POSITION_PERFORMANCE_QUERY = `
  query GetPositionPerformance($positionId: ID!) {
    positionNFT(id: $positionId) {
      id
      owner
      tickLower
      tickUpper
      liquidity
      classification
      lifetimeBlocks
      totalFeeGrowth0
      totalFeeGrowth1
      feeGrowthInsidePeriod0
      feeGrowthInsidePeriod1
      modificationCount
      totalRewardsEarned
      checkpoints(
        orderBy: blockNumber
        orderDirection: asc
      ) {
        id
        blockNumber
        timestamp
        feeGrowthInside0LastX128
        feeGrowthInside1LastX128
        liquidity
      }
      modifications(
        orderBy: blockNumber
        orderDirection: asc
      ) {
        id
        blockNumber
        timestamp
        newLiquidityAmount
        owner
      }
      subscriptions {
        wallet
        subscribedAtTimestamp
        unsubscribedAtTimestamp
        isActive
      }
      positionRewards {
        distribution {
          epoch
          reward
          rewardFormatted
        }
        feeGrowthDuringEpoch
        weightedScore
        classification
      }
    }
  }
`;

async function querySubgraph(query: string, variables?: any) {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
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

// Competitive analysis function
export async function runCompetitiveAnalysis() {
  console.log("🔍 Running Competitive Analysis...\n");
  console.log(`Your Wallet: ${YOUR_WALLET}\n`);

  const data = await querySubgraph(COMPETITIVE_ANALYSIS_QUERY, {
    yourWallet: YOUR_WALLET,
  });

  if (!data) {
    console.error("Failed to fetch data");
    return;
  }

  const yourPositions = data.yourPositions || [];
  const competitorPositions = data.competitorPositions || [];

  console.log(`📊 Your Positions: ${yourPositions.length}`);
  console.log(`🏆 Competitor Positions: ${competitorPositions.length}\n`);

  // Your positions summary
  if (yourPositions.length > 0) {
    console.log("=".repeat(80));
    console.log("YOUR POSITIONS");
    console.log("=".repeat(80));
    
    let totalLiquidity = 0;
    let totalRewards = 0;
    
    yourPositions.forEach((pos: any, idx: number) => {
      console.log(`\nPosition #${idx + 1} (ID: ${pos.id})`);
      console.log(`  Classification: ${pos.classification}`);
      console.log(`  Liquidity: ${pos.liquidity}`);
      console.log(`  Lifetime: ${pos.lifetimeBlocks} blocks`);
      console.log(`  Modifications: ${pos.modificationCount}`);
      console.log(`  Fee Growth 0: ${pos.totalFeeGrowth0}`);
      console.log(`  Fee Growth 1: ${pos.totalFeeGrowth1}`);
      console.log(`  Total Rewards: ${pos.totalRewardsEarned}`);
      totalLiquidity += parseFloat(pos.liquidity || "0");
      totalRewards += parseFloat(pos.totalRewardsEarned || "0");
    });
    
    console.log(`\n📈 Your Total Liquidity: ${totalLiquidity.toLocaleString()}`);
    console.log(`💰 Your Total Rewards: ${totalRewards.toLocaleString()}`);
  }

  // Top competitors
  if (competitorPositions.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("TOP COMPETITORS");
    console.log("=".repeat(80));
    
    // Group by owner
    const byOwner: { [key: string]: any[] } = {};
    competitorPositions.forEach((pos: any) => {
      if (!byOwner[pos.owner]) {
        byOwner[pos.owner] = [];
      }
      byOwner[pos.owner].push(pos);
    });

    // Calculate totals per owner
    const ownerStats = Object.entries(byOwner).map(([owner, positions]) => {
      const totalLiq = positions.reduce((sum, p) => sum + parseFloat(p.liquidity || "0"), 0);
      const totalRew = positions.reduce((sum, p) => sum + parseFloat(p.totalRewardsEarned || "0"), 0);
      const passiveCount = positions.filter((p: any) => p.classification === "Passive").length;
      
      return {
        owner,
        positionCount: positions.length,
        totalLiquidity: totalLiq,
        totalRewards: totalRew,
        passiveCount,
        positions,
      };
    });

    // Sort by total liquidity
    ownerStats.sort((a, b) => b.totalLiquidity - a.totalLiquidity);

    ownerStats.slice(0, 10).forEach((stats, idx) => {
      console.log(`\n${idx + 1}. ${stats.owner}`);
      console.log(`   Positions: ${stats.positionCount} (${stats.passiveCount} Passive)`);
      console.log(`   Total Liquidity: ${stats.totalLiquidity.toLocaleString()}`);
      console.log(`   Total Rewards: ${stats.totalRewards.toLocaleString()}`);
    });
  }
}

// Export all positions to CSV
export async function exportAllPositions() {
  console.log("📥 Exporting all positions to CSV format...\n");

  const data = await querySubgraph(ALL_POSITIONS_QUERY);

  if (!data || !data.positionNFTs) {
    console.error("Failed to fetch positions");
    return;
  }

  const positions = data.positionNFTs;

  // CSV header
  console.log("positionId,owner,tickLower,tickUpper,liquidity,classification,lifetimeBlocks,modificationCount,totalFeeGrowth0,totalFeeGrowth1,feeGrowthInsidePeriod0,feeGrowthInsidePeriod1,totalRewardsEarned,createdAtTimestamp,updatedAtTimestamp");

  // CSV rows
  positions.forEach((pos: any) => {
    const row = [
      pos.id,
      pos.owner,
      pos.tickLower,
      pos.tickUpper,
      pos.liquidity,
      pos.classification,
      pos.lifetimeBlocks,
      pos.modificationCount,
      pos.totalFeeGrowth0,
      pos.totalFeeGrowth1,
      pos.feeGrowthInsidePeriod0,
      pos.feeGrowthInsidePeriod1,
      pos.totalRewardsEarned,
      pos.createdAtTimestamp,
      pos.updatedAtTimestamp,
    ].join(",");
    console.log(row);
  });

  console.log(`\n✅ Exported ${positions.length} positions`);
}

// Get epoch rewards
export async function getEpochRewards(epoch: string) {
  console.log(`📊 Fetching rewards for epoch ${epoch}...\n`);

  const data = await querySubgraph(EPOCH_REWARDS_QUERY, { epoch });

  if (!data || !data.rewardDistributions) {
    console.error("Failed to fetch epoch rewards");
    return;
  }

  const distributions = data.rewardDistributions;

  console.log(`Found ${distributions.length} reward distributions\n`);

  distributions.forEach((dist: any, idx: number) => {
    console.log(`${idx + 1}. Wallet: ${dist.wallet}`);
    console.log(`   Reward: ${dist.rewardFormatted || dist.reward} TEL`);
    console.log(`   Period Fees Currency 0: ${dist.periodFeesCurrency0Formatted || dist.periodFeesCurrency0}`);
    console.log(`   Period Fees Currency 1: ${dist.periodFeesCurrency1Formatted || dist.periodFeesCurrency1}`);
    console.log(`   Total Fees Common Denominator: ${dist.totalFeesCommonDenominator}`);
    if (dist.positionRewards && dist.positionRewards.length > 0) {
      console.log(`   Positions: ${dist.positionRewards.length}`);
    }
    console.log("");
  });
}

// CLI interface
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case "competitive":
    runCompetitiveAnalysis();
    break;
  case "export":
    exportAllPositions();
    break;
  case "epoch":
    if (!arg) {
      console.error("Please provide epoch number: npm run query epoch <epochNumber>");
      process.exit(1);
    }
    getEpochRewards(arg);
    break;
  default:
    console.log("Usage:");
    console.log("  npm run query competitive  - Run competitive analysis");
    console.log("  npm run query export      - Export all positions to CSV");
    console.log("  npm run query epoch <num>  - Get rewards for specific epoch");
}

