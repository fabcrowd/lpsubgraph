/**
 * Live TELx Snapshot Helper
 * 
 * Computes a live snapshot of epoch rewards as if the epoch ended now.
 * This uses the canonical TELx scoring logic to show what rewards would be
 * distributed if the epoch ended at the current block.
 */

import { calculateTelxEpoch, TelxEpochConfig } from "./epochScoring";

export interface LiveTelxSnapshot {
  startBlock: number;
  endBlock: number;
  totalRewardsTel: bigint;
  perWallet: {
    address: string;
    rewardTel: bigint;
    rewardShare: number; // 0..1
  }[];
}

export interface LiveSnapshotConfig extends Omit<TelxEpochConfig, 'endBlock'> {
  endBlock?: number;
  rpcUrl?: string; // Optional RPC URL for fetching latest block
}

/**
 * Fetch latest block number from RPC
 */
async function fetchLatestBlock(rpcUrl: string): Promise<number> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1
      }),
    });
    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return parseInt(result.result, 16);
  } catch (error) {
    console.error("Error fetching latest block:", error);
    throw error;
  }
}

/**
 * Compute live TELx snapshot
 * 
 * If endBlock is not provided, fetches the latest block number from RPC.
 * Then calls calculateTelxEpoch to compute rewards as if epoch ended now.
 */
export async function computeLiveTelxSnapshot(
  cfg: LiveSnapshotConfig
): Promise<LiveTelxSnapshot> {
  // Determine endBlock
  let endBlock = cfg.endBlock;
  
  if (!endBlock) {
    // Fetch latest block from RPC
    const rpcUrl = cfg.rpcUrl || process.env.RPC_URL || "https://mainnet.base.org";
    endBlock = await fetchLatestBlock(rpcUrl);
  }
  
  // Call calculateTelxEpoch with full config
  const epochConfig: TelxEpochConfig = {
    ...cfg,
    endBlock
  };
  
  const result = await calculateTelxEpoch(epochConfig);
  
  // Calculate total rewards distributed so far
  const totalRewardsTelSoFar = result.totalRewardsDistributed;
  
  // Calculate reward share for each wallet
  const perWallet = result.perWallet.map(wallet => {
    const rewardShare = totalRewardsTelSoFar === BigInt(0)
      ? 0
      : Number(wallet.rewardTel) / Number(totalRewardsTelSoFar);
    
    return {
      address: wallet.address,
      rewardTel: wallet.rewardTel,
      rewardShare
    };
  });
  
  return {
    startBlock: cfg.startBlock,
    endBlock,
    totalRewardsTel: totalRewardsTelSoFar,
    perWallet
  };
}

