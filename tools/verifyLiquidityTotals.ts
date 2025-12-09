/**
 * Verify total liquidity in pool matches website data
 * 
 * Website shows: 12.45 ETH and 17.2M TEL
 * This tool converts Uniswap v4 liquidity to actual token amounts
 */

import fetch from "node-fetch";
import { TELX_BASE_CONFIG } from "../config/telxBasePool";

// The Graph Studio query URL format: https://api.studio.thegraph.com/query/{deployment-id}/{subgraph-name}/version/latest
const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.studio.thegraph.com/query/1718314/telx-v-4-pool/version/latest";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const POSITION_REGISTRY = TELX_BASE_CONFIG.positionRegistry;

// Function selector for getAmountsForLiquidity(bytes32,uint128,int24,int24)
const FUNCTION_SELECTOR = "0x4f8e3a8e";

function encodeInt24(value: number): string {
  if (value < 0) {
    const unsigned = (0x1000000 + value) & 0xFFFFFF;
    return unsigned.toString(16).padStart(64, 'f');
  }
  return value.toString(16).padStart(64, '0');
}

async function getAmountsForLiquidity(
  poolId: string,
  liquidity: bigint,
  tickLower: number,
  tickUpper: number
): Promise<{ amount0: bigint; amount1: bigint } | null> {
  try {
    const poolIdHex = (poolId.startsWith('0x') ? poolId.slice(2) : poolId).toLowerCase().padStart(64, '0');
    const liquidityHex = liquidity.toString(16).padStart(64, '0');
    const tickLowerHex = encodeInt24(tickLower);
    const tickUpperHex = encodeInt24(tickUpper);
    
    const data = FUNCTION_SELECTOR + poolIdHex + liquidityHex + tickLowerHex + tickUpperHex;
    
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: POSITION_REGISTRY.toLowerCase(),
            data: data.toLowerCase()
          },
          "latest"
        ],
        id: 1
      }),
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.warn(`  RPC error: ${result.error.message}`);
      return null;
    }
    
    if (!result.result || result.result === "0x") {
      return null;
    }
    
    const returnData = result.result.startsWith('0x') ? result.result.slice(2) : result.result;
    
    // Extract amount0 (bytes 0-63) and amount1 (bytes 64-127)
    const amount0Hex = returnData.slice(0, 64);
    const amount1Hex = returnData.slice(64, 128);
    
    const amount0 = BigInt("0x" + amount0Hex);
    const amount1 = BigInt("0x" + amount1Hex);
    
    return { amount0, amount1 };
  } catch (error) {
    console.warn(`  Error calling getAmountsForLiquidity: ${error}`);
    return null;
  }
}

const QUERY = `
  query GetSubscribedPositions($poolId: String!) {
    positionNFTs(
      where: { 
        pool: $poolId
        isSubscribed: true
      }
    ) {
      id
      tickLower
      tickUpper
      liquidity
    }
  }
`;

async function verifyLiquidityTotals() {
  console.log("=".repeat(80));
  console.log("Total Liquidity Verification (Subscribed Positions Only)");
  console.log("=".repeat(80));
  console.log(`Subgraph URL: ${SUBGRAPH_URL}`);
  console.log(`Pool ID: ${TELX_BASE_CONFIG.poolId}`);
  console.log(`Expected: 12.45 ETH and 17.2M TEL\n`);

  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          poolId: TELX_BASE_CONFIG.poolId.toLowerCase()
        }
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("❌ GraphQL errors:", result.errors);
      return;
    }

    const positions = result.data.positionNFTs || [];
    console.log(`📊 Found ${positions.length} subscribed positions\n`);

    let totalAmount0 = BigInt(0);
    let totalAmount1 = BigInt(0);
    let successful = 0;
    let failed = 0;

    console.log("Converting liquidity to token amounts...\n");
    console.log("Note: This may take a few minutes due to RPC rate limits...\n");

    // Add delay between RPC calls to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const liquidity = BigInt(position.liquidity || "0");
      const tickLower = parseInt(position.tickLower || "0");
      const tickUpper = parseInt(position.tickUpper || "0");

      if (liquidity === BigInt(0)) {
        continue;
      }

      const amounts = await getAmountsForLiquidity(
        TELX_BASE_CONFIG.poolId,
        liquidity,
        tickLower,
        tickUpper
      );

      if (amounts) {
        totalAmount0 += amounts.amount0;
        totalAmount1 += amounts.amount1;
        successful++;
      } else {
        failed++;
        console.warn(`  Position ${position.id}: Failed to get amounts`);
      }

      // Add delay to avoid rate limiting (except for last position)
      if (i < positions.length - 1) {
        await delay(200); // 200ms delay between calls
      }
    }

    console.log(`\n📊 Results:\n`);
    console.log(`   Positions processed: ${successful} successful, ${failed} failed`);
    console.log(`   Total Amount0 (ETH, 18 decimals): ${totalAmount0.toString()}`);
    console.log(`   Total Amount1 (TEL, 18 decimals): ${totalAmount1.toString()}`);
    
    const ethAmount = Number(totalAmount0) / 1e18;
    const telAmount = Number(totalAmount1) / 1e18;
    
    console.log(`\n   Total ETH: ${ethAmount.toFixed(2)}`);
    console.log(`   Total TEL: ${telAmount.toFixed(2)}`);
    console.log(`   Total TEL (M): ${(telAmount / 1e6).toFixed(2)}M\n`);

    // Compare with expected values
    const expectedETH = 12.45;
    const expectedTEL = 17.2e6; // 17.2M
    
    const ethDiff = Math.abs(ethAmount - expectedETH);
    const telDiff = Math.abs(telAmount - expectedTEL);
    const ethDiffPercent = (ethDiff / expectedETH) * 100;
    const telDiffPercent = (telDiff / expectedTEL) * 100;

    console.log(`📊 Comparison with Website:\n`);
    console.log(`   ETH:`);
    console.log(`     Website: ${expectedETH} ETH`);
    console.log(`     Subgraph: ${ethAmount.toFixed(2)} ETH`);
    console.log(`     Difference: ${ethDiff.toFixed(2)} ETH (${ethDiffPercent.toFixed(2)}%)\n`);
    
    console.log(`   TEL:`);
    console.log(`     Website: ${expectedTEL.toLocaleString()} TEL (17.2M)`);
    console.log(`     Subgraph: ${telAmount.toLocaleString()} TEL (${(telAmount / 1e6).toFixed(2)}M)`);
    console.log(`     Difference: ${telDiff.toLocaleString()} TEL (${telDiffPercent.toFixed(2)}%)\n`);

    if (ethDiffPercent < 1 && telDiffPercent < 1) {
      console.log(`✅ Values match closely (within 1%)\n`);
    } else if (ethDiffPercent < 5 && telDiffPercent < 5) {
      console.log(`⚠️  Values are close but not exact (within 5%)\n`);
      console.log(`   Possible reasons:`);
      console.log(`   - Price changes between website snapshot and now`);
      console.log(`   - Some positions may have been added/removed`);
      console.log(`   - Rounding differences\n`);
    } else {
      console.log(`❌ Significant difference (>5%)\n`);
      console.log(`   Need to investigate:\n`);
      console.log(`   - Are we only counting subscribed positions?`);
      console.log(`   - Are we using the correct pool ID?`);
      console.log(`   - Is the website data from a different time?`);
    }

    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

verifyLiquidityTotals().catch(console.error);

