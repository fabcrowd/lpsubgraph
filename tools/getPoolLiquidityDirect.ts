/**
 * Get pool liquidity directly from the Uniswap v4 Pool contract
 * 
 * Alternative to RPC calls per position - queries the pool contract directly
 */

import fetch from "node-fetch";
import { TELX_BASE_CONFIG } from "../config/telxBasePool";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.studio.thegraph.com/query/1718314/telx-v-4-pool/version/latest";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

// Pool contract address (from subgraph.yaml)
const POOL_ADDRESS = "0x23aB2e6D4Ab0c5f872567098671F1ffb46Fd2500";

// Uniswap v4 PoolManager functions
// getSlot0(bytes32 poolId) returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
const GET_SLOT0_SELECTOR = "0x3850c7bd"; // keccak256("getSlot0(bytes32)").slice(0, 4)

// Alternative: Use PositionRegistry to get pool liquidity
// The PositionRegistry might have a function to get total pool liquidity

async function getPoolSlot0(poolId: string): Promise<{ sqrtPriceX96: bigint; tick: number } | null> {
  try {
    const poolIdHex = (poolId.startsWith('0x') ? poolId.slice(2) : poolId).toLowerCase().padStart(64, '0');
    const data = GET_SLOT0_SELECTOR + poolIdHex;
    
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: POOL_ADDRESS.toLowerCase(),
            data: "0x" + data.toLowerCase()
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
    
    // Extract sqrtPriceX96 (bytes 0-39, uint160 = 20 bytes = 40 hex chars)
    const sqrtPriceX96Hex = returnData.slice(0, 40);
    const sqrtPriceX96 = BigInt("0x" + sqrtPriceX96Hex);
    
    // Extract tick (bytes 40-47, int24 = 3 bytes = 6 hex chars, but padded to 64)
    const tickHex = returnData.slice(40, 48);
    const tick = parseInt(tickHex, 16);
    // Handle negative ticks (two's complement)
    const tickValue = tick > 0x7FFFFF ? tick - 0x1000000 : tick;
    
    return { sqrtPriceX96, tick: tickValue };
  } catch (error) {
    console.warn(`  Error calling getSlot0: ${error}`);
    return null;
  }
}

/**
 * Calculate token amounts from liquidity using Uniswap v4 math
 * This is a simplified calculation - for accurate amounts, we'd need the full tick math
 */
function calculateTokenAmountsFromLiquidity(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number
): { amount0: bigint; amount1: bigint } {
  // This is a simplified version - full implementation would use Uniswap v4 tick math
  // For now, we'll use the PositionRegistry's getAmountsForLiquidity if available
  // or approximate based on price
  
  // Approximate: if price is in range, liquidity is split between tokens
  // This is not accurate but gives an estimate
  const Q96 = BigInt(2) ** BigInt(96);
  const price = (sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
  
  // Simplified calculation - not accurate for all tick ranges
  // Would need proper Uniswap v4 tick math library
  return {
    amount0: BigInt(0), // Placeholder
    amount1: BigInt(0) // Placeholder
  };
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

async function getPoolLiquidityDirect() {
  console.log("=".repeat(80));
  console.log("Pool Liquidity - Direct Contract Query");
  console.log("=".repeat(80));
  console.log(`Pool ID: ${TELX_BASE_CONFIG.poolId}`);
  console.log(`Pool Address: ${POOL_ADDRESS}`);
  console.log(`Expected: 12.45 ETH and 17.2M TEL\n`);

  // Get pool state
  console.log("📊 Fetching pool state from contract...\n");
  const poolState = await getPoolSlot0(TELX_BASE_CONFIG.poolId);
  
  if (poolState) {
    console.log(`✅ Pool state retrieved:`);
    console.log(`   sqrtPriceX96: ${poolState.sqrtPriceX96.toString()}`);
    console.log(`   Current Tick: ${poolState.tick}\n`);
  } else {
    console.log(`❌ Failed to get pool state from contract\n`);
  }

  // Get positions from subgraph
  console.log("📊 Fetching subscribed positions from subgraph...\n");
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
    console.log(`✅ Found ${positions.length} subscribed positions\n`);

    // Sum raw liquidity (this is what we're already doing in the report)
    const totalRawLiquidity = positions.reduce((sum: bigint, p: any) => {
      return sum + BigInt(p.liquidity || "0");
    }, BigInt(0));

    console.log(`📊 Total Raw Liquidity (from subgraph):`);
    console.log(`   ${totalRawLiquidity.toString()}\n`);

    console.log("💡 Alternative Approaches:\n");
    console.log("1. Use a different RPC provider (Alchemy, Infura) with better rate limits");
    console.log("2. Add longer delays between RPC calls (500ms-1000ms)");
    console.log("3. Use batch RPC calls if the provider supports it");
    console.log("4. Query the website's API directly if available");
    console.log("5. Use the subgraph's raw liquidity sum (already available)");
    console.log("\n📊 Current Status:");
    console.log(`   We have ${positions.length} subscribed positions");
    console.log(`   Total raw liquidity: ${totalRawLiquidity.toString()}`);
    console.log(`   To convert to ETH/TEL, we need to call getAmountsForLiquidity for each position");
    console.log(`   But RPC rate limits are preventing this\n`);

    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

getPoolLiquidityDirect().catch(console.error);

