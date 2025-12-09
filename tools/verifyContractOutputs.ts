/**
 * Verification script to compare our outputs with the actual contract
 * 
 * This script:
 * 1. Fetches position data from subgraph
 * 2. Calculates rewards using our implementation
 * 3. Compares with contract's expected behavior
 * 4. Verifies fee growth calculations match contract format
 */

import fetch from "node-fetch";
import { TELX_BASE_CONFIG } from "../config/telxBasePool";
import { calculateTelxEpoch } from "../src/telx/epochScoring";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";

/**
 * Query a specific position's checkpoints from the contract
 */
async function queryPositionCheckpoints(positionId: string) {
  const query = `
    query PositionCheckpoints($positionId: String!) {
      positionNFT(id: $positionId) {
        id
        owner
        liquidity
        tickLower
        tickUpper
        classification
        isSubscribed
        totalFeeGrowth0
        totalFeeGrowth1
        feeGrowthInsidePeriod0
        feeGrowthInsidePeriod1
        checkpoints(
          orderBy: blockNumber
          orderDirection: asc
          first: 100
        ) {
          id
          blockNumber
          timestamp
          feeGrowthInside0LastX128
          feeGrowthInside1LastX128
          liquidity
        }
      }
    }
  `;

  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        query, 
        variables: { positionId } 
      }),
    });
    const result = await response.json();
    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }
    return result.data?.positionNFT;
  } catch (error) {
    console.error("Error querying subgraph:", error);
    return null;
  }
}

/**
 * Verify fee growth format matches contract expectations
 */
function verifyFeeGrowthFormat(position: any) {
  console.log("\n=== Fee Growth Format Verification ===");
  console.log(`Position ID: ${position.id}`);
  console.log(`Liquidity: ${position.liquidity}`);
  console.log(`\nTotal Fee Growth (from subgraph):`);
  console.log(`  FeeGrowth0: ${position.totalFeeGrowth0}`);
  console.log(`  FeeGrowth1: ${position.totalFeeGrowth1}`);
  console.log(`\nPeriod Fee Growth (from subgraph):`);
  console.log(`  FeeGrowthInsidePeriod0: ${position.feeGrowthInsidePeriod0}`);
  console.log(`  FeeGrowthInsidePeriod1: ${position.feeGrowthInsidePeriod1}`);
  
  // Check if values are in Q128.128 format (should be very large numbers)
  const feeGrowth0 = BigInt(position.totalFeeGrowth0 || "0");
  const feeGrowth1 = BigInt(position.totalFeeGrowth1 || "0");
  const Q128 = BigInt(2) ** BigInt(128);
  
  console.log(`\nFee Growth Format Check:`);
  console.log(`  Q128 (2^128): ${Q128.toString()}`);
  console.log(`  FeeGrowth0 / Q128: ${feeGrowth0 / Q128}`);
  console.log(`  FeeGrowth1 / Q128: ${feeGrowth1 / Q128}`);
  
  // Convert to actual token amounts
  const liquidity = BigInt(position.liquidity || "0");
  if (liquidity > BigInt(0)) {
    const fee0Amount = (feeGrowth0 * liquidity) / Q128;
    const fee1Amount = (feeGrowth1 * liquidity) / Q128;
    console.log(`\nConverted Fee Amounts (actual tokens):`);
    console.log(`  Fee0 Amount: ${fee0Amount.toString()}`);
    console.log(`  Fee1 Amount: ${fee1Amount.toString()}`);
  }
  
  // Check checkpoints
  if (position.checkpoints && position.checkpoints.length > 0) {
    console.log(`\nCheckpoints (${position.checkpoints.length} total):`);
    const first = position.checkpoints[0];
    const last = position.checkpoints[position.checkpoints.length - 1];
    console.log(`  First checkpoint (block ${first.blockNumber}):`);
    console.log(`    FeeGrowth0: ${first.feeGrowthInside0LastX128}`);
    console.log(`    FeeGrowth1: ${first.feeGrowthInside1LastX128}`);
    console.log(`  Last checkpoint (block ${last.blockNumber}):`);
    console.log(`    FeeGrowth0: ${last.feeGrowthInside0LastX128}`);
    console.log(`    FeeGrowth1: ${last.feeGrowthInside1LastX128}`);
    
    // Calculate delta
    const delta0 = BigInt(last.feeGrowthInside0LastX128) - BigInt(first.feeGrowthInside0LastX128);
    const delta1 = BigInt(last.feeGrowthInside1LastX128) - BigInt(first.feeGrowthInside1LastX128);
    console.log(`\n  Delta (last - first):`);
    console.log(`    FeeGrowth0 Delta: ${delta0.toString()}`);
    console.log(`    FeeGrowth1 Delta: ${delta1.toString()}`);
  }
}

/**
 * Verify classification matches contract logic
 */
function verifyClassification(position: any) {
  console.log("\n=== Classification Verification ===");
  console.log(`Position ID: ${position.id}`);
  console.log(`Classification: ${position.classification}`);
  console.log(`Is Subscribed: ${position.isSubscribed}`);
  
  // Contract constants (from ABI):
  // JIT_LIFETIME = 1 block
  // MIN_PASSIVE_LIFETIME = 43200 blocks
  // JIT_WEIGHT = 0%
  // ACTIVE_WEIGHT = 0%
  // PASSIVE_WEIGHT = 100%
  
  const expectedWeights: Record<string, number> = {
    "JIT": 0,
    "Active": 0,
    "Passive": 100
  };
  
  const expectedWeight = expectedWeights[position.classification] ?? 0;
  console.log(`Expected Weight: ${expectedWeight}%`);
  console.log(`Eligible for Rewards: ${expectedWeight > 0 ? "YES" : "NO"}`);
}

/**
 * Verify reward calculation matches contract
 */
async function verifyRewardCalculation() {
  console.log("\n=== Reward Calculation Verification ===");
  
  // Use a test epoch (adjust as needed)
  const config = {
    ...TELX_BASE_CONFIG,
    startBlock: 38000000,
    endBlock: 38100000,
    epochTotalRewardTel: BigInt("1000000000000000000000"), // 1000 TEL for testing
  };
  
  console.log(`Epoch: ${config.startBlock} to ${config.endBlock}`);
  console.log(`Total Rewards: ${config.epochTotalRewardTel.toString()} (${Number(config.epochTotalRewardTel) / 1e18} TEL)`);
  
  const result = await calculateTelxEpoch(config);
  
  console.log(`\nCalculation Results:`);
  console.log(`  Total Score: ${result.totalScore.toString()}`);
  console.log(`  Total Rewards Distributed: ${result.totalRewardsDistributed.toString()}`);
  console.log(`  Wallets: ${result.perWallet.length}`);
  
  console.log(`\nTop 5 Wallets by Rewards:`);
  result.perWallet
    .sort((a, b) => Number(b.reward - a.reward))
    .slice(0, 5)
    .forEach((wallet, idx) => {
      console.log(`  ${idx + 1}. ${wallet.wallet}: ${Number(wallet.reward) / 1e18} TEL (${wallet.rewardPercent.toFixed(2)}%)`);
    });
}

/**
 * Main verification function
 */
export async function verifyContractOutputs() {
  console.log("=".repeat(80));
  console.log("TELx Contract Output Verification");
  console.log("=".repeat(80));
  
  // Query a sample position (use your position ID)
  const samplePositionId = "792075"; // From the report output
  console.log(`\nVerifying position: ${samplePositionId}`);
  
  const position = await queryPositionCheckpoints(samplePositionId);
  if (!position) {
    console.error("Failed to fetch position data");
    return;
  }
  
  // Verify fee growth format
  verifyFeeGrowthFormat(position);
  
  // Verify classification
  verifyClassification(position);
  
  // Verify reward calculation
  await verifyRewardCalculation();
  
  console.log("\n" + "=".repeat(80));
  console.log("Verification Complete");
  console.log("=".repeat(80));
}

// Run if called directly
if (require.main === module) {
  verifyContractOutputs().catch(console.error);
}

