import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { calculateTelxEpoch } from "../src/telx/epochScoring";

const EXCEL_PATH = path.join(__dirname, "../../base-ETH-TEL-16 (2).xlsx");
const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.studio.thegraph.com/query/1718314/telx-v-4-pool/version/latest";
const YOUR_WALLET = "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445";
const POSITION_REGISTRY = "0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04";
const POOL_ID = "0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b";

interface ExcelReward {
  lpAddress: string;
  periodFeesCurrency0_formatted: string;
  periodFeesCurrency1_formatted: string;
  reward_formatted: string;
  totalFeesCommonDenominator: string;
}

function readExcelRewards(): ExcelReward[] {
  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const rewardsSheet = workbook.Sheets["LP Rewards"];
    const rewardsData = XLSX.utils.sheet_to_json(rewardsSheet) as any[];
    
    return rewardsData.map((row: any) => ({
      lpAddress: String(row.lpAddress || "").toLowerCase(),
      periodFeesCurrency0_formatted: String(row.periodFeesCurrency0_formatted || "0"),
      periodFeesCurrency1_formatted: String(row.periodFeesCurrency1_formatted || "0"),
      reward_formatted: String(row.reward_formatted || "0"),
      totalFeesCommonDenominator: String(row.totalFeesCommonDenominator || "0"),
    }));
  } catch (error) {
    console.error("Error reading Excel file:", error);
    return [];
  }
}

function readExcelInfo(): { startBlock: number; endBlock: number; totalReward?: bigint } {
  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const infoSheet = workbook.Sheets["Top Level Info"];
    const infoData = XLSX.utils.sheet_to_json(infoSheet, { header: ["param", "value"] }) as any[];
    
    const info: { [key: string]: string } = {};
    infoData.forEach((row: any) => {
      if (row.param && row.value) {
        info[row.param] = String(row.value);
      }
    });
    
    const startBlock = parseInt(info["Start Block"] || "0");
    const endBlock = parseInt(info["End Block"] || "0");
    
    // Calculate total reward from Excel rewards
    const rewards = readExcelRewards();
    const totalReward = rewards.reduce((sum, r) => {
      const reward = parseFloat(r.reward_formatted);
      return sum + (isNaN(reward) ? 0 : reward);
    }, 0);
    
    return {
      startBlock,
      endBlock,
      totalReward: BigInt(Math.floor(totalReward * 1e18)) // Convert to wei (18 decimals)
    };
  } catch (error) {
    console.error("Error reading Excel info:", error);
    return { startBlock: 0, endBlock: 0 };
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("Epoch 16 Rewards Comparison: Excel vs Our Calculation");
  console.log("=".repeat(80));
  console.log(`Subgraph URL: ${SUBGRAPH_URL}`);
  console.log(`Your Wallet: ${YOUR_WALLET}\n`);
  
  // Read Excel data
  const excelRewards = readExcelRewards();
  const excelInfo = readExcelInfo();
  
  console.log(`📊 Excel Data:`);
  console.log(`   Start Block: ${excelInfo.startBlock}`);
  console.log(`   End Block: ${excelInfo.endBlock}`);
  console.log(`   Total Rewards: ${excelRewards.length} wallets`);
  console.log(`   Total Reward Amount: ${excelInfo.totalReward ? (Number(excelInfo.totalReward) / 1e18).toFixed(2) : "Unknown"} TEL\n`);
  
  // Find your reward in Excel
  const yourExcelReward = excelRewards.find(r => r.lpAddress.toLowerCase() === YOUR_WALLET.toLowerCase());
  
  if (yourExcelReward) {
    console.log(`💰 Your Reward (Excel):`);
    console.log(`   Reward: ${yourExcelReward.reward_formatted} TEL`);
    console.log(`   Period Fees Currency 0: ${yourExcelReward.periodFeesCurrency0_formatted}`);
    console.log(`   Period Fees Currency 1: ${yourExcelReward.periodFeesCurrency1_formatted}`);
    console.log(`   Total Fees Common Denominator: ${yourExcelReward.totalFeesCommonDenominator}\n`);
  }
  
  // Calculate using our code
  console.log(`🔧 Calculating Epoch 16 Rewards Using Our Code...\n`);
  
  if (!excelInfo.startBlock || !excelInfo.endBlock) {
    console.error("❌ Could not read epoch blocks from Excel");
    return;
  }
  
  if (!excelInfo.totalReward) {
    console.warn("⚠️  Could not determine total reward from Excel. Using placeholder.");
    console.warn("   This will affect reward amounts but not the distribution ratios.\n");
  }
  
  try {
    const result = await calculateTelxEpoch({
      poolId: POOL_ID,
      startBlock: excelInfo.startBlock,
      endBlock: excelInfo.endBlock,
      totalRewardTel: excelInfo.totalReward || BigInt("1000000000000000000000"), // Placeholder if unknown
      subgraphUrl: SUBGRAPH_URL,
      positionRegistry: POSITION_REGISTRY,
      rpcUrl: process.env.RPC_URL || "https://mainnet.base.org"
    });
    
    console.log(`✅ Calculation Complete!\n`);
    console.log(`📊 Our Calculation Results:`);
    console.log(`   Total Positions Processed: ${result.perWallet.length}`);
    console.log(`   Total Weighted Score: ${result.totalScore.toString()}`);
    console.log(`   Total Rewards Distributed: ${(Number(result.totalRewardsDistributed) / 1e18).toFixed(2)} TEL\n`);
    
    // Find your reward in our calculation
    const yourCalculatedReward = result.perWallet.find(w => w.address.toLowerCase() === YOUR_WALLET.toLowerCase());
    
    if (yourCalculatedReward) {
      console.log(`💰 Your Reward (Our Calculation):`);
      console.log(`   Reward: ${(Number(yourCalculatedReward.rewardTel) / 1e18).toFixed(2)} TEL`);
      if (yourCalculatedReward.weightedScore) {
        console.log(`   Weighted Score: ${yourCalculatedReward.weightedScore.toString()}`);
      }
      console.log("");
      
      // Compare
      if (yourExcelReward) {
        const excelReward = parseFloat(yourExcelReward.reward_formatted);
        const calculatedReward = Number(yourCalculatedReward.rewardTel) / 1e18;
        const diff = Math.abs(excelReward - calculatedReward);
        const diffPercent = (diff / excelReward) * 100;
        
        console.log(`📊 Comparison:`);
        console.log(`   Excel Reward: ${excelReward.toFixed(2)} TEL`);
        console.log(`   Our Reward: ${calculatedReward.toFixed(2)} TEL`);
        console.log(`   Difference: ${diff.toFixed(2)} TEL (${diffPercent.toFixed(2)}%)\n`);
        
        if (diffPercent < 0.01) {
          console.log(`✅ Rewards match! (within 0.01%)\n`);
        } else if (diffPercent < 1) {
          console.log(`⚠️  Rewards are close but not exact (${diffPercent.toFixed(2)}% difference)\n`);
          console.log(`   Possible reasons:`);
          console.log(`   - Token price difference (Excel uses epoch-end price, we use current)`);
          console.log(`   - Missing positions (24 positions not in subgraph)`);
          console.log(`   - Rounding differences\n`);
        } else {
          console.log(`❌ Significant difference (${diffPercent.toFixed(2)}%)\n`);
          console.log(`   Need to investigate:`);
          console.log(`   - Token price calculation`);
          console.log(`   - Fee growth calculation`);
          console.log(`   - Liquidity value used`);
          console.log(`   - Missing positions impact\n`);
        }
      }
    } else {
      console.log(`⚠️  Your wallet not found in calculated rewards`);
      console.log(`   This could mean:`);
      console.log(`   - No subscribed positions during epoch 16`);
      console.log(`   - All positions classified as JIT/Active (0% weight)`);
      console.log(`   - Positions not in subgraph\n`);
    }
    
    // Show top 10 rewards for comparison
    console.log(`📊 Top 10 Rewards (Our Calculation):`);
    result.perWallet.slice(0, 10).forEach((w, idx) => {
      const excelReward = excelRewards.find(r => r.lpAddress.toLowerCase() === w.address.toLowerCase());
      const excelRewardStr = excelReward ? `${excelReward.reward_formatted} TEL` : "N/A";
      console.log(`   ${idx + 1}. ${w.address}: ${(Number(w.rewardTel) / 1e18).toFixed(2)} TEL (Excel: ${excelRewardStr})`);
    });
    
  } catch (error) {
    console.error("❌ Error calculating rewards:", error);
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("Comparison Complete");
  console.log("=".repeat(80));
}

main().catch(console.error);

