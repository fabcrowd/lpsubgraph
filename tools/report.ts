/**
 * CLI entry point for report generation
 * 
 * Usage:
 *   npm run report:text  - Print plain text report
 *   npm run report:json  - Print JSON to stdout
 */

import { fetchPoolData } from "../src/data/fetchData";
import { enrichPoolSummaryWithAPR } from "../src/metrics/aprEngine";
import { generateTextReport } from "../src/reporting/textReport";
import { generateJSONReport } from "../src/reporting/jsonReport";
import { computeLiveTelxSnapshot } from "../src/telx/liveSnapshot";
import { TELX_BASE_CONFIG } from "../config/telxBasePool";

async function main() {
  const outputFormat = process.argv[2] || "text";

  // Fetch data
  const poolData = await fetchPoolData();

  if (!poolData) {
    console.error("❌ Failed to fetch data from subgraph");
    console.log("\nPossible reasons:");
    console.log("  - Subgraph not deployed yet");
    console.log("  - Subgraph still syncing");
    console.log("  - SUBGRAPH_URL not set correctly");
    console.log("\nSet SUBGRAPH_URL environment variable:");
    console.log('  $env:SUBGRAPH_URL="https://api.studio.thegraph.com/query/.../telx-v4-pool/..."');
    process.exit(1);
  }

  // Compute live TELx snapshot (if config is set)
  let liveRewardByWallet = new Map<string, { rewardTel: bigint; rewardShare: number }>();
  
  if (TELX_BASE_CONFIG.positionRegistry !== '<POSITION_REGISTRY_ADDRESS_ON_BASE>' && 
      TELX_BASE_CONFIG.poolId !== '<POOL_ID_FOR_THIS_V4_POOL>' &&
      TELX_BASE_CONFIG.epochStartBlock > 0 &&
      TELX_BASE_CONFIG.epochTotalRewardTel > BigInt(0)) {
    try {
      const snapshot = await computeLiveTelxSnapshot({
        network: TELX_BASE_CONFIG.network,
        positionRegistry: TELX_BASE_CONFIG.positionRegistry,
        poolId: TELX_BASE_CONFIG.poolId,
        startBlock: TELX_BASE_CONFIG.epochStartBlock,
        totalRewardTel: TELX_BASE_CONFIG.epochTotalRewardTel,
        subgraphUrl: poolData.subgraphUrl,
        rpcUrl: TELX_BASE_CONFIG.rpcUrl
      });
      
      // Build lookup map
      liveRewardByWallet = new Map(
        snapshot.perWallet.map(w => [w.address.toLowerCase(), w])
      );
    } catch (error) {
      console.error("⚠️  Warning: Failed to compute live TELx snapshot:", error);
      console.error("   Continuing without live reward data...\n");
    }
  }

  // Enrich wallet summaries with live rewards
  poolData.wallets = poolData.wallets.map(wallet => {
    const liveReward = liveRewardByWallet.get(wallet.wallet.toLowerCase());
    
    if (liveReward) {
      return {
        ...wallet,
        liveRewardTelSoFar: liveReward.rewardTel,
        liveRewardShare: liveReward.rewardShare,
        liveRewardSharePercent: liveReward.rewardShare * 100
      };
    } else {
      return {
        ...wallet,
        liveRewardTelSoFar: BigInt(0),
        liveRewardShare: 0,
        liveRewardSharePercent: 0
      };
    }
  });

  // Enrich with APR metrics
  const enrichedData = enrichPoolSummaryWithAPR(poolData);

  // Generate report based on format
  if (outputFormat === "json") {
    const jsonOutput = generateJSONReport(enrichedData);
    console.log(jsonOutput);
  } else {
    generateTextReport(enrichedData);
  }
}

main().catch((error) => {
  console.error("Error generating report:", error);
  process.exit(1);
});

