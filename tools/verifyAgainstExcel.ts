import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";

const EXCEL_PATH = path.join(__dirname, "../../base-ETH-TEL-16 (2).xlsx");
const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";
const YOUR_WALLET = "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445";

interface ExcelPosition {
  positionId: string;
  lastOwner: string;
  tickLower: number;
  tickUpper: number;
  lastLiquidity: string;
  feeGrowthInsidePeriod0_formatted: string;
  feeGrowthInsidePeriod1_formatted: string;
}

interface ExcelReward {
  lpAddress: string;
  periodFeesCurrency0_formatted: string;
  periodFeesCurrency1_formatted: string;
  reward_formatted: string;
  totalFeesCommonDenominator: string;
}

async function querySubgraph(query: string, variables?: any) {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
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

function readExcelData() {
  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const positionsSheet = workbook.Sheets["Positions"];
    const rewardsSheet = workbook.Sheets["LP Rewards"];
    const infoSheet = workbook.Sheets["Top Level Info"];

    // Read positions
    const positionsData = XLSX.utils.sheet_to_json(positionsSheet) as any[];
    const positions: ExcelPosition[] = positionsData.map((row: any) => ({
      positionId: String(row.positionId),
      lastOwner: String(row.lastOwner || ""),
      tickLower: Number(row.tickLower || 0),
      tickUpper: Number(row.tickUpper || 0),
      lastLiquidity: String(row.lastLiquidity || "0"),
      feeGrowthInsidePeriod0_formatted: String(row.feeGrowthInsidePeriod0_formatted || "0"),
      feeGrowthInsidePeriod1_formatted: String(row.feeGrowthInsidePeriod1_formatted || "0"),
    }));

    // Read rewards
    const rewardsData = XLSX.utils.sheet_to_json(rewardsSheet) as any[];
    const rewards: ExcelReward[] = rewardsData.map((row: any) => ({
      lpAddress: String(row.lpAddress || "").toLowerCase(),
      periodFeesCurrency0_formatted: String(row.periodFeesCurrency0_formatted || "0"),
      periodFeesCurrency1_formatted: String(row.periodFeesCurrency1_formatted || "0"),
      reward_formatted: String(row.reward_formatted || "0"),
      totalFeesCommonDenominator: String(row.totalFeesCommonDenominator || "0"),
    }));

    // Read epoch info
    const infoData = XLSX.utils.sheet_to_json(infoSheet, { header: ["param", "value"] }) as any[];
    const info: { [key: string]: string } = {};
    infoData.forEach((row: any) => {
      if (row.param && row.value) {
        info[row.param] = String(row.value);
      }
    });

    return { positions, rewards, info };
  } catch (error) {
    console.error("Error reading Excel file:", error);
    return null;
  }
}

async function verifyPositions() {
  console.log("📊 Verifying Positions...\n");

  const excelData = readExcelData();
  if (!excelData) {
    console.error("❌ Failed to read Excel file");
    return;
  }

  const { positions: excelPositions, info } = excelData;

  console.log(`Excel has ${excelPositions.length} positions`);
  console.log(`Epoch: ${info["File Name"] || "Unknown"}`);
  console.log(`Start Block: ${info["Start Block"] || "Unknown"}`);
  console.log(`End Block: ${info["End Block"] || "Unknown"}\n`);

  // Query subgraph
  const query = `
    query GetPositions {
      positionNFTs(first: 1000, orderBy: id) {
        id
        owner
        tickLower
        tickUpper
        liquidity
        totalFeeGrowth0
        totalFeeGrowth1
        isSubscribed
      }
    }
  `;

  const data = await querySubgraph(query);
  if (!data || !data.positionNFTs) {
    console.log("⚠️  Subgraph not available or no data yet");
    console.log("   This is normal if subgraph hasn't synced yet");
    console.log("   Expected positions from Excel:", excelPositions.length);
    return;
  }

  const subgraphPositions = data.positionNFTs;
  console.log(`Subgraph has ${subgraphPositions.length} positions\n`);

  // Compare
  let matched = 0;
  let missing = 0;
  let differences: string[] = [];

  excelPositions.forEach((excelPos) => {
    const subgraphPos = subgraphPositions.find((p: any) => p.id === excelPos.positionId);
    if (subgraphPos) {
      matched++;
      // Check for differences
      if (subgraphPos.owner.toLowerCase() !== excelPos.lastOwner.toLowerCase()) {
        differences.push(
          `Position ${excelPos.positionId}: Owner mismatch (Excel: ${excelPos.lastOwner}, Subgraph: ${subgraphPos.owner})`
        );
      }
      if (String(subgraphPos.tickLower) !== String(excelPos.tickLower)) {
        differences.push(
          `Position ${excelPos.positionId}: tickLower mismatch (Excel: ${excelPos.tickLower}, Subgraph: ${subgraphPos.tickLower})`
        );
      }
      if (String(subgraphPos.tickUpper) !== String(excelPos.tickUpper)) {
        differences.push(
          `Position ${excelPos.positionId}: tickUpper mismatch (Excel: ${excelPos.tickUpper}, Subgraph: ${subgraphPos.tickUpper})`
        );
      }
    } else {
      missing++;
      console.log(`⚠️  Position ${excelPos.positionId} not found in subgraph`);
    }
  });

  console.log(`✅ Matched: ${matched}/${excelPositions.length}`);
  console.log(`❌ Missing: ${missing}/${excelPositions.length}`);

  if (differences.length > 0) {
    console.log(`\n⚠️  Found ${differences.length} differences:`);
    differences.slice(0, 10).forEach((diff) => console.log(`   ${diff}`));
    if (differences.length > 10) {
      console.log(`   ... and ${differences.length - 10} more`);
    }
  } else if (matched > 0) {
    console.log("\n✅ All matched positions have consistent data!");
  }
}

async function verifyRewards() {
  console.log("\n💰 Verifying Rewards...\n");

  const excelData = readExcelData();
  if (!excelData) {
    return;
  }

  const { rewards: excelRewards } = excelData;
  console.log(`Excel has ${excelRewards.length} reward distributions`);

  // Find your reward
  const yourReward = excelRewards.find(
    (r) => r.lpAddress.toLowerCase() === YOUR_WALLET.toLowerCase()
  );

  if (yourReward) {
    console.log(`\n📊 Your Rewards (Epoch 16):`);
    console.log(`   Reward: ${yourReward.reward_formatted} TEL`);
    console.log(`   Period Fees Currency 0: ${yourReward.periodFeesCurrency0_formatted}`);
    console.log(`   Period Fees Currency 1: ${yourReward.periodFeesCurrency1_formatted}`);
    console.log(`   Total Fees Common Denominator: ${yourReward.totalFeesCommonDenominator}`);
  } else {
    console.log(`\n⚠️  Your wallet (${YOUR_WALLET}) not found in rewards`);
  }

  // Query subgraph for rewards
  const query = `
    query GetRewards {
      rewardDistributions(first: 1000, orderBy: reward, orderDirection: desc) {
        wallet
        reward
        rewardFormatted
        periodFeesCurrency0Formatted
        periodFeesCurrency1Formatted
      }
    }
  `;

  const data = await querySubgraph(query);
  if (data && data.rewardDistributions) {
    console.log(`\nSubgraph has ${data.rewardDistributions.length} reward distributions`);
    const yourSubgraphReward = data.rewardDistributions.find(
      (r: any) => r.wallet.toLowerCase() === YOUR_WALLET.toLowerCase()
    );
    if (yourSubgraphReward) {
      console.log(`\n📊 Your Rewards (Subgraph):`);
      console.log(`   Reward: ${yourSubgraphReward.rewardFormatted || yourSubgraphReward.reward} TEL`);
    }
  } else {
    console.log("\n⚠️  Subgraph rewards not available yet (may need to sync)");
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("TELx Subgraph Verification Against Excel Data");
  console.log("=".repeat(80));
  console.log(`Subgraph URL: ${SUBGRAPH_URL}`);
  console.log(`Your Wallet: ${YOUR_WALLET}\n`);

  await verifyPositions();
  await verifyRewards();

  console.log("\n" + "=".repeat(80));
  console.log("Verification Complete");
  console.log("=".repeat(80));
  console.log("\nNote: If subgraph shows no data, it may need time to sync.");
  console.log("      Check subgraph status and wait for indexing to complete.");
}

main().catch(console.error);

