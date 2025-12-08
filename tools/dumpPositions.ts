import fetch from "node-fetch";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/telx-v4-pool";

const QUERY = `
  query GetPositions($poolId: ID!) {
    positions(where: { pool: $poolId }) {
      id
      owner
      tickLower
      tickUpper
      liquidity
    }
  }
`;

async function dumpPositions(poolId: string) {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { poolId },
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      process.exit(1);
    }

    const positions = result.data?.positions || [];

    if (positions.length === 0) {
      console.log("No positions found for pool:", poolId);
      return;
    }

    // Print CSV-like header
    console.log("owner,tickLower,tickUpper,liquidity");

    // Print each position
    for (const position of positions) {
      console.log(
        `${position.owner},${position.tickLower},${position.tickUpper},${position.liquidity}`
      );
    }

    console.log(`\nTotal positions: ${positions.length}`);
  } catch (error) {
    console.error("Error fetching positions:", error);
    process.exit(1);
  }
}

// Get pool ID from command line argument or use default
const poolId = process.argv[2] || "0x23aB2e6D4Ab0c5f872567098671F1ffb46Fd2500";

dumpPositions(poolId);

