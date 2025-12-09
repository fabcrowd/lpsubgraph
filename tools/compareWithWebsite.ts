/**
 * Compare subgraph data with website data
 * 
 * This tool helps verify that our subgraph data matches what's displayed on the website
 */

import fetch from "node-fetch";
import { TELX_BASE_CONFIG } from "../config/telxBasePool";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.studio.thegraph.com/query/1718314/telx-v-4-pool/version/latest";
const YOUR_WALLET = "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445";

// Website data from screenshot
const WEBSITE_DATA = {
  poolAddress: "0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b",
  tvl: "$129,793.79",
  volume24h: "$13,855.60",
  fees24h: "$41.57",
  rewards7days: "648,148 TEL",
  // Position token amounts (from positions interface)
  positions: {
    "792075": { token0: "0", token1: "1404053.73" },
    "792091": { token0: "0", token1: "686890.1" },
    "803942": { token0: "0.125824781238153851", token1: "98554.26" }
  }
};

const QUERY = `
  query CompareWithWebsite($poolId: String!, $wallet: String!) {
    positionNFTs(
      where: { 
        pool: $poolId
        owner: $wallet
        isSubscribed: true
      }
      orderBy: liquidity
      orderDirection: desc
    ) {
      id
      owner
      tickLower
      tickUpper
      liquidity
      classification
      isSubscribed
      totalFeeGrowth0
      totalFeeGrowth1
    }
    pools(where: { id: $poolId }) {
      id
      totalLiquidity
    }
  }
`;

async function compareData() {
  console.log("=".repeat(80));
  console.log("Subgraph vs Website Data Comparison");
  console.log("=".repeat(80));
  console.log(`Subgraph URL: ${SUBGRAPH_URL}`);
  console.log(`Pool ID: ${TELX_BASE_CONFIG.poolId}`);
  console.log(`Your Wallet: ${YOUR_WALLET}\n`);

  // Verify pool address matches
  console.log("📊 Pool Address Verification:");
  const poolAddressMatch = TELX_BASE_CONFIG.poolId.toLowerCase() === WEBSITE_DATA.poolAddress.toLowerCase();
  console.log(`   Website: ${WEBSITE_DATA.poolAddress}`);
  console.log(`   Config:  ${TELX_BASE_CONFIG.poolId}`);
  console.log(`   Match:   ${poolAddressMatch ? "✅ YES" : "❌ NO"}\n`);

  // Query subgraph
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          poolId: TELX_BASE_CONFIG.poolId.toLowerCase(),
          wallet: YOUR_WALLET.toLowerCase()
        }
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("❌ GraphQL errors:", result.errors);
      return;
    }

    const positions = result.data.positionNFTs || [];
    const pool = result.data.pools?.[0];

    console.log(`📊 Position Data Comparison:\n`);
    console.log(`   Found ${positions.length} subscribed positions in subgraph\n`);

    // Compare each position
    for (const position of positions) {
      const positionId = position.id;
      const websiteData = WEBSITE_DATA.positions[positionId];

      console.log(`   Position ${positionId}:`);
      console.log(`     Classification: ${position.classification || "Unknown"}`);
      console.log(`     Liquidity (raw): ${position.liquidity}`);
      
      if (websiteData) {
        console.log(`     Website Token0: ${websiteData.token0}`);
        console.log(`     Website Token1: ${websiteData.token1}`);
        console.log(`     ✅ Found in website data`);
      } else {
        console.log(`     ⚠️  Not found in website data (may be newly subscribed)`);
      }
      console.log("");
    }

    // Check for positions in website but not in subgraph
    console.log(`📊 Positions in Website but not in Subgraph:\n`);
    const subgraphPositionIds = new Set(positions.map((p: any) => p.id));
    for (const [positionId, data] of Object.entries(WEBSITE_DATA.positions)) {
      if (!subgraphPositionIds.has(positionId)) {
        console.log(`   Position ${positionId}: Found in website but not in subgraph`);
        console.log(`     Token0: ${(data as any).token0}`);
        console.log(`     Token1: ${(data as any).token1}`);
      }
    }

    // Pool-level data
    if (pool) {
      console.log(`\n📊 Pool-Level Data:\n`);
      console.log(`   Total Liquidity (subgraph): ${pool.totalLiquidity || "N/A"}`);
      console.log(`   TVL (website): ${WEBSITE_DATA.tvl}`);
      console.log(`   Volume 24h (website): ${WEBSITE_DATA.volume24h}`);
      console.log(`   Fees 24h (website): ${WEBSITE_DATA.fees24h}`);
      console.log(`   Rewards 7 days (website): ${WEBSITE_DATA.rewards7days}`);
      console.log(`\n   Note: TVL/Volume/Fees require token prices to convert liquidity to USD`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("Comparison Complete");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("❌ Error querying subgraph:", error);
  }
}

compareData().catch(console.error);

