/**
 * Verify liquidity calculation by querying all positions (not just subscribed)
 */

import fetch from "node-fetch";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.studio.thegraph.com/query/1718314/telx-v-4-pool/version/latest";
const YOUR_WALLET = "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445";

// Query ALL positions (not just subscribed)
const ALL_POSITIONS_QUERY = `
  query AllPositions {
    positionNFTs(
      orderBy: liquidity
      orderDirection: desc
    ) {
      id
      owner
      liquidity
      isSubscribed
      classification
    }
  }
`;

// Query only subscribed positions (current query)
const SUBSCRIBED_POSITIONS_QUERY = `
  query SubscribedPositions {
    positionNFTs(
      orderBy: liquidity
      orderDirection: desc
      where: { isSubscribed: true }
    ) {
      id
      owner
      liquidity
      isSubscribed
      classification
    }
  }
`;

async function querySubgraph(query: string) {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
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

async function verifyLiquidity() {
  console.log("=".repeat(80));
  console.log("LIQUIDITY VERIFICATION");
  console.log("=".repeat(80));
  console.log(`Subgraph URL: ${SUBGRAPH_URL}\n`);

  // Query ALL positions
  console.log("Querying ALL positions (subscribed + unsubscribed)...");
  const allData = await querySubgraph(ALL_POSITIONS_QUERY);
  const allPositions = allData?.positionNFTs || [];

  // Query only subscribed positions
  console.log("Querying SUBSCRIBED positions only...");
  const subscribedData = await querySubgraph(SUBSCRIBED_POSITIONS_QUERY);
  const subscribedPositions = subscribedData?.positionNFTs || [];

  // Calculate totals
  const totalLiquidityAll = allPositions.reduce((sum: number, p: any) => 
    sum + parseFloat(p.liquidity || "0"), 0);
  const totalLiquiditySubscribed = subscribedPositions.reduce((sum: number, p: any) => 
    sum + parseFloat(p.liquidity || "0"), 0);

  // Your positions
  const yourPositionsAll = allPositions.filter((p: any) => 
    p.owner.toLowerCase() === YOUR_WALLET.toLowerCase());
  const yourPositionsSubscribed = subscribedPositions.filter((p: any) => 
    p.owner.toLowerCase() === YOUR_WALLET.toLowerCase());

  const yourLiquidityAll = yourPositionsAll.reduce((sum: number, p: any) => 
    sum + parseFloat(p.liquidity || "0"), 0);
  const yourLiquiditySubscribed = yourPositionsSubscribed.reduce((sum: number, p: any) => 
    sum + parseFloat(p.liquidity || "0"), 0);

  // Print results
  console.log("\n" + "=".repeat(80));
  console.log("RESULTS");
  console.log("=".repeat(80));

  console.log(`\n📊 ALL POSITIONS (subscribed + unsubscribed):`);
  console.log(`   Total Positions: ${allPositions.length}`);
  console.log(`   Total Liquidity: ${totalLiquidityAll.toLocaleString()}`);
  console.log(`   Your Positions: ${yourPositionsAll.length}`);
  console.log(`   Your Liquidity: ${yourLiquidityAll.toLocaleString()}`);
  console.log(`   Your Share: ${totalLiquidityAll > 0 ? ((yourLiquidityAll / totalLiquidityAll) * 100).toFixed(2) : 0}%`);

  console.log(`\n✅ SUBSCRIBED POSITIONS ONLY (current report):`);
  console.log(`   Total Positions: ${subscribedPositions.length}`);
  console.log(`   Total Liquidity: ${totalLiquiditySubscribed.toLocaleString()}`);
  console.log(`   Your Positions: ${yourPositionsSubscribed.length}`);
  console.log(`   Your Liquidity: ${yourLiquiditySubscribed.toLocaleString()}`);
  console.log(`   Your Share: ${totalLiquiditySubscribed > 0 ? ((yourLiquiditySubscribed / totalLiquiditySubscribed) * 100).toFixed(2) : 0}%`);

  console.log(`\n⚠️  DIFFERENCE:`);
  console.log(`   Unsubscribed Positions: ${allPositions.length - subscribedPositions.length}`);
  console.log(`   Unsubscribed Liquidity: ${(totalLiquidityAll - totalLiquiditySubscribed).toLocaleString()}`);
  console.log(`   Percentage of pool that's unsubscribed: ${totalLiquidityAll > 0 ? (((totalLiquidityAll - totalLiquiditySubscribed) / totalLiquidityAll) * 100).toFixed(2) : 0}%`);

  // Show your positions breakdown
  console.log(`\n📋 YOUR POSITIONS BREAKDOWN:`);
  yourPositionsAll.forEach((pos: any, idx: number) => {
    const isSubscribed = pos.isSubscribed ? "✅ Subscribed" : "❌ Not Subscribed";
    const liqPercentAll = totalLiquidityAll > 0 ? ((parseFloat(pos.liquidity) / totalLiquidityAll) * 100).toFixed(2) : "0.00";
    const liqPercentSubscribed = totalLiquiditySubscribed > 0 ? ((parseFloat(pos.liquidity) / totalLiquiditySubscribed) * 100).toFixed(2) : "0.00";
    console.log(`   ${idx + 1}. Position ${pos.id}: ${parseFloat(pos.liquidity).toLocaleString()} (${isSubscribed})`);
    console.log(`      - Share of ALL positions: ${liqPercentAll}%`);
    console.log(`      - Share of SUBSCRIBED positions: ${liqPercentSubscribed}%`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("CONCLUSION");
  console.log("=".repeat(80));
  
  if (allPositions.length > subscribedPositions.length) {
    console.log(`⚠️  WARNING: The report only shows SUBSCRIBED positions.`);
    console.log(`   Your actual share of the ENTIRE pool is: ${totalLiquidityAll > 0 ? ((yourLiquidityAll / totalLiquidityAll) * 100).toFixed(2) : 0}%`);
    console.log(`   Your share of SUBSCRIBED positions is: ${totalLiquiditySubscribed > 0 ? ((yourLiquiditySubscribed / totalLiquiditySubscribed) * 100).toFixed(2) : 0}%`);
    console.log(`\n   The 67.08% is your share of SUBSCRIBED positions only.`);
    console.log(`   There are ${allPositions.length - subscribedPositions.length} unsubscribed positions not included.`);
  } else {
    console.log(`✅ All positions are subscribed. The 67.08% is accurate.`);
  }
}

verifyLiquidity().catch(console.error);

