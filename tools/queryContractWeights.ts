/**
 * Query deployed PositionRegistry contract to get actual weight values
 */

import fetch from "node-fetch";

const POSITION_REGISTRY = "0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

// Function selectors (first 4 bytes of keccak256 hash)
const SELECTORS = {
  JIT_WEIGHT: "0x" + "jitWeight()".split("").map(c => c.charCodeAt(0).toString(16)).join(""), // Simplified - need actual
  ACTIVE_WEIGHT: "0x" + "activeWeight()".split("").map(c => c.charCodeAt(0).toString(16)).join(""),
  PASSIVE_WEIGHT: "0x" + "passiveWeight()".split("").map(c => c.charCodeAt(0).toString(16)).join(""),
  MIN_PASSIVE_LIFETIME: "0x" + "minPassiveLifetime()".split("").map(c => c.charCodeAt(0).toString(16)).join(""),
};

// Actual function selectors from ABI
const ACTUAL_SELECTORS = {
  JIT_WEIGHT: "0x" + "JIT_WEIGHT()".split("").map(c => c.charCodeAt(0).toString(16)).join(""),
  ACTIVE_WEIGHT: "0x" + "ACTIVE_WEIGHT()".split("").map(c => c.charCodeAt(0).toString(16)).join(""),
  PASSIVE_WEIGHT: "0x" + "PASSIVE_WEIGHT()".split("").map(c => c.charCodeAt(0).toString(16)).join(""),
  MIN_PASSIVE_LIFETIME: "0x" + "MIN_PASSIVE_LIFETIME()".split("").map(c => c.charCodeAt(0).toString(16)).join(""),
};

// Use proper keccak256 hashes (first 4 bytes)
const FUNCTION_SELECTORS = {
  JIT_WEIGHT: "0x8c5be1e5", // keccak256("JIT_WEIGHT()")[0:4] - need to calculate properly
  ACTIVE_WEIGHT: "0x5c60da1b", // keccak256("ACTIVE_WEIGHT()")[0:4]
  PASSIVE_WEIGHT: "0x4e71d92d", // keccak256("PASSIVE_WEIGHT()")[0:4]
  MIN_PASSIVE_LIFETIME: "0x12345678", // Placeholder - need actual
};

// Proper selectors from ABI (calculated from function signatures)
const SELECTORS_FROM_ABI = {
  JIT_WEIGHT: "0x8c5be1e5", // Placeholder - calculate from actual ABI
  ACTIVE_WEIGHT: "0x5c60da1b", // Placeholder
  PASSIVE_WEIGHT: "0x4e71d92d", // Placeholder
  MIN_PASSIVE_LIFETIME: "0x12345678", // Placeholder
};

async function callContract(functionName: string, selector: string): Promise<bigint | null> {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: POSITION_REGISTRY.toLowerCase(),
            data: selector.toLowerCase()
          },
          "latest"
        ],
        id: 1
      }),
    });
    
    const result = await response.json();
    if (result.error) {
      console.error(`Error calling ${functionName}:`, result.error);
      return null;
    }
    
    const hexValue = result.result;
    if (!hexValue || hexValue === "0x") {
      return null;
    }
    
    return BigInt(hexValue);
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    return null;
  }
}

export async function queryContractWeights() {
  console.log("=".repeat(80));
  console.log("Querying Deployed PositionRegistry Contract Weights");
  console.log("=".repeat(80));
  console.log(`Contract: ${POSITION_REGISTRY}`);
  console.log(`RPC: ${RPC_URL}\n`);

  // Note: We need the actual function selectors from the ABI
  // For now, this is a template - you'll need to:
  // 1. Get the actual function selectors from the ABI
  // 2. Or use a library like ethers.js to encode the calls
  
  console.log("⚠️  This tool needs actual function selectors from the ABI.");
  console.log("To get the selectors:");
  console.log("1. Use ethers.js: ethers.utils.id('JIT_WEIGHT()').slice(0, 10)");
  console.log("2. Or query the ABI from BaseScan");
  console.log("3. Or use a tool like cast: cast sig 'JIT_WEIGHT()'");
  
  console.log("\nExpected values from contract constructor:");
  console.log("  JIT_WEIGHT: 0 (0%)");
  console.log("  ACTIVE_WEIGHT: 2_500 (25%) - but may be configured differently");
  console.log("  PASSIVE_WEIGHT: 10_000 (100%)");
  console.log("  MIN_PASSIVE_LIFETIME: 43_200 blocks");
  
  console.log("\nOur current implementation:");
  console.log("  JIT_WEIGHT: 0 (0%)");
  console.log("  ACTIVE_WEIGHT: 0 (0%) ⚠️  Mismatch!");
  console.log("  PASSIVE_WEIGHT: 100 (100%)");
  console.log("  MIN_PASSIVE_LIFETIME: 43_200 blocks");
}

if (require.main === module) {
  queryContractWeights().catch(console.error);
}

