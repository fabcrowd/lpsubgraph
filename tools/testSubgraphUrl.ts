/**
 * Test subgraph URL to verify it's working
 */

import fetch from "node-fetch";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.studio.thegraph.com/query/1718314/telx-v-4-pool/version/latest";

async function testSubgraphUrl() {
  console.log("Testing Subgraph URL...\n");
  console.log(`URL: ${SUBGRAPH_URL}\n`);

  const testQuery = `
    query TestQuery {
      positionNFTs(first: 1) {
        id
        owner
        isSubscribed
      }
      pools(first: 1) {
        id
      }
    }
  `;

  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: testQuery }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("❌ GraphQL Errors:");
      result.errors.forEach((error: any) => {
        console.error(`   ${error.message}`);
      });
      console.log("\n⚠️  This URL might be incorrect or the subgraph might not be synced.");
      console.log("\nTo find the correct URL:");
      console.log("1. Go to https://thegraph.com/studio/subgraph/telx-v-4-pool/");
      console.log("2. Look for the 'Query URL' or 'Playground' section");
      console.log("3. Copy the full URL");
      console.log("4. Set it as: $env:SUBGRAPH_URL=\"YOUR_URL\"");
      return;
    }

    if (result.data) {
      console.log("✅ Subgraph URL is working!\n");
      console.log("Sample data:");
      if (result.data.positionNFTs && result.data.positionNFTs.length > 0) {
        console.log(`   Found ${result.data.positionNFTs.length} position(s)`);
        console.log(`   First position ID: ${result.data.positionNFTs[0].id}`);
      }
      if (result.data.pools && result.data.pools.length > 0) {
        console.log(`   Found ${result.data.pools.length} pool(s)`);
        console.log(`   Pool ID: ${result.data.pools[0].id}`);
      }
      console.log("\n✅ You can use this URL for queries!");
    } else {
      console.log("⚠️  No data returned (subgraph might be empty or still syncing)");
    }
  } catch (error: any) {
    console.error("❌ Error connecting to subgraph:");
    console.error(`   ${error.message}`);
    console.log("\nPossible issues:");
    console.log("1. URL is incorrect");
    console.log("2. Subgraph is not deployed");
    console.log("3. Network connectivity issue");
    console.log("\nTo find the correct URL:");
    console.log("1. Go to https://thegraph.com/studio/subgraph/telx-v-4-pool/");
    console.log("2. Look for the 'Query URL' or 'Playground' section");
    console.log("3. Copy the full URL");
  }
}

testSubgraphUrl().catch(console.error);

