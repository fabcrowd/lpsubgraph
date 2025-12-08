import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";

const POSITION_REGISTRY_ADDRESS = "0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

async function fetchABI() {
  try {
    // Try Basescan API first
    const url = `https://api.basescan.org/api?module=contract&action=getabi&address=${POSITION_REGISTRY_ADDRESS}&apikey=${BASESCAN_API_KEY}`;
    
    console.log("Fetching ABI from Basescan...");
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "1" && data.result) {
      const abi = JSON.parse(data.result);
      const abiPath = path.join(__dirname, "../abis/PositionRegistry.json");
      fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
      console.log(`✅ ABI saved to ${abiPath}`);
      console.log(`Found ${abi.length} items in ABI`);
      
      // Show events
      const events = abi.filter((item: any) => item.type === "event");
      console.log(`\nFound ${events.length} events:`);
      events.forEach((event: any) => {
        console.log(`  - ${event.name}`);
      });
      
      return abi;
    } else {
      console.error("❌ Failed to fetch ABI:", data.message || "Unknown error");
      console.log("\nPlease:");
      console.log("1. Get a free API key from https://basescan.org/apis");
      console.log("2. Set it as: export BASESCAN_API_KEY=your_key");
      console.log("3. Or manually copy the ABI from https://basescan.org/address/" + POSITION_REGISTRY_ADDRESS);
      return null;
    }
  } catch (error) {
    console.error("Error fetching ABI:", error);
    return null;
  }
}

fetchABI();

