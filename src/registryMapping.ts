import { BigInt, Bytes, Address, BigDecimal } from "@graphprotocol/graph-ts";
import {
  Checkpoint,
  PositionUpdated,
  Subscribed,
  Unsubscribed,
  RewardsClaimed,
} from "../generated/PositionRegistry/PositionRegistry";
import {
  PositionNFT,
  FeeGrowthCheckpoint,
  WalletSubscription,
  RewardDistribution,
  LiquidityModification,
  Pool,
} from "../generated/schema";

// Constants from TELx documentation
const PASSIVE_THRESHOLD_BLOCKS = BigInt.fromI32(43200); // ~24 hours on Base
const JIT_THRESHOLD_BLOCKS = BigInt.fromI32(1); // Same block or very short timeframe

// Helper function to get or create pool
function getOrCreatePool(poolId: Bytes): Pool {
  let poolIdStr = poolId.toHexString();
  let pool = Pool.load(poolIdStr);
  if (pool == null) {
    pool = new Pool(poolIdStr);
    pool.token0 = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    pool.token1 = Bytes.fromHexString("0x09bE1692ca16e06f536F0038fF11D1dA8524aDB1"); // TEL token
    pool.fee = 0;
    pool.currentTick = BigInt.fromI32(0);
    pool.save();
  }
  return pool;
}

// Handle PositionUpdated - this gives us position details (tickLower, tickUpper, liquidity, owner)
export function handlePositionUpdated(event: PositionUpdated): void {
  let positionId = event.params.tokenId.toString();
  let poolId = event.params.poolId.toHexString();
  let owner = event.params.owner;
  
  let pool = getOrCreatePool(event.params.poolId);
  
  let position = PositionNFT.load(positionId);
  if (position == null) {
    position = new PositionNFT(positionId);
    position.pool = poolId;
    position.owner = owner as Bytes;
    position.tickLower = BigInt.fromI32(event.params.tickLower);
    position.tickUpper = BigInt.fromI32(event.params.tickUpper);
    position.liquidity = event.params.liquidity;
    position.createdAtBlock = event.block.number;
    position.createdAtTimestamp = event.block.timestamp;
    position.updatedAtBlock = event.block.number;
    position.updatedAtTimestamp = event.block.timestamp;
    position.feeGrowthInsidePeriod0 = BigInt.fromI32(0);
    position.feeGrowthInsidePeriod1 = BigInt.fromI32(0);
    position.isSubscribed = false;
    position.totalFeeGrowth0 = BigInt.fromI32(0);
    position.totalFeeGrowth1 = BigInt.fromI32(0);
    position.lifetimeBlocks = BigInt.fromI32(0);
    position.classification = "Passive";
    position.modificationCount = 0;
    position.totalRewardsEarned = BigInt.fromI32(0);
  }
  
  // Update position details
  position.owner = owner as Bytes;
  position.pool = poolId;
  position.tickLower = BigInt.fromI32(event.params.tickLower);
  position.tickUpper = BigInt.fromI32(event.params.tickUpper);
  
  // Track liquidity modification if liquidity changed
  let previousLiquidity = position.liquidity;
  let newLiquidity = event.params.liquidity;
  let liquidityChanged = !previousLiquidity.equals(newLiquidity);
  
  // IMPORTANT: Save the previous modification block BEFORE we update it
  // This is the block number of the last liquidity modification
  let lastModificationBlock = position.updatedAtBlock;
  let currentBlock = event.block.number;
  
  // Update position details
  position.liquidity = newLiquidity;
  position.updatedAtBlock = event.block.number;
  position.updatedAtTimestamp = event.block.timestamp;
  position.lifetimeBlocks = event.block.number.minus(position.createdAtBlock);
  
  // Only track as modification if liquidity actually changed (not just a position update)
  if (liquidityChanged && previousLiquidity.gt(BigInt.fromI32(0))) {
    // Create liquidity modification record
    let modId = positionId.concat("-").concat(event.block.number.toString());
    let modification = new LiquidityModification(modId);
    modification.position = positionId;
    modification.blockNumber = event.block.number;
    modification.timestamp = event.block.timestamp;
    modification.newLiquidityAmount = newLiquidity;
    modification.owner = owner as Bytes;
    modification.save();
    
    position.modificationCount = position.modificationCount + 1;
    
    // Classify based on 24-hour LOOKBACK period:
    // Check if there have been modifications within the last 43200 blocks (24 hours)
    // Calculate the 24-hour lookback window start block (current block - 43200)
    let lookbackStartBlock = currentBlock.minus(PASSIVE_THRESHOLD_BLOCKS);
    
    // Use the saved last modification block (before we updated it)
    let previousModBlock = lastModificationBlock;
    
    // Check if previous modification was within the 24-hour lookback window
    if (position.modificationCount >= 2 && previousModBlock.gt(BigInt.fromI32(0))) {
      let blockDiff = currentBlock.minus(previousModBlock);
      
      if (blockDiff.le(JIT_THRESHOLD_BLOCKS)) {
        // Same block or very short timeframe - JIT
        position.classification = "JIT";
      } else if (previousModBlock.ge(lookbackStartBlock)) {
        // Last modification was within the last 24 hours (43200 blocks lookback) - Active
        // This means there HAS been a modification in the 24-hour lookback period
        position.classification = "Active";
      } else {
        // Previous modification was more than 24 hours ago - Passive
        // No modifications in the last 24-hour lookback period
        position.classification = "Passive";
      }
    } else if (position.modificationCount == 1) {
      // First modification - Passive (no previous modifications to check)
      position.classification = "Passive";
    }
    // If modificationCount == 0, keep existing classification (defaults to Passive)
  }
  // If liquidity didn't change, keep existing classification
  
  position.save();
}

// Handle Checkpoint - tracks fee growth (note: feeGrowth is int128, not uint256)
export function handleCheckpoint(event: Checkpoint): void {
  let positionId = event.params.tokenId.toString();
  let poolId = event.params.poolId.toHexString();
  let checkpointIndex = event.params.checkpointIndex;
  
  let position = PositionNFT.load(positionId);
  if (position == null) {
    // Position should exist from PositionUpdated, but create if needed
    let pool = getOrCreatePool(event.params.poolId);
    position = new PositionNFT(positionId);
    position.pool = poolId;
    position.owner = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    position.tickLower = BigInt.fromI32(0);
    position.tickUpper = BigInt.fromI32(0);
    position.liquidity = BigInt.fromI32(0);
    position.createdAtBlock = event.block.number;
    position.createdAtTimestamp = event.block.timestamp;
    position.updatedAtBlock = event.block.number;
    position.updatedAtTimestamp = event.block.timestamp;
    position.feeGrowthInsidePeriod0 = BigInt.fromI32(0);
    position.feeGrowthInsidePeriod1 = BigInt.fromI32(0);
    position.isSubscribed = false;
    position.totalFeeGrowth0 = BigInt.fromI32(0);
    position.totalFeeGrowth1 = BigInt.fromI32(0);
    position.lifetimeBlocks = BigInt.fromI32(0);
    position.classification = "Passive";
    position.modificationCount = 0;
    position.totalRewardsEarned = BigInt.fromI32(0);
  }

  // Convert int128 to BigInt (handle signed integers)
  let feeGrowth0 = event.params.feeGrowthInside0X128;
  let feeGrowth1 = event.params.feeGrowthInside1X128;
  
  // Update position fee growth
  position.totalFeeGrowth0 = feeGrowth0;
  position.totalFeeGrowth1 = feeGrowth1;
  position.updatedAtBlock = event.block.number;
  position.updatedAtTimestamp = event.block.timestamp;

  // Create checkpoint
  let checkpointId = positionId.concat("-").concat(checkpointIndex.toString());
  let checkpoint = new FeeGrowthCheckpoint(checkpointId);
  checkpoint.position = positionId;
  checkpoint.blockNumber = event.block.number;
  checkpoint.timestamp = event.block.timestamp;
  checkpoint.feeGrowthInside0LastX128 = feeGrowth0;
  checkpoint.feeGrowthInside1LastX128 = feeGrowth1;
  checkpoint.liquidity = position.liquidity; // Get from position, not event
  checkpoint.save();

  position.latestCheckpoint = checkpointId;
  position.save();
}

// Handle Subscribed - note: parameter order is tokenId, owner (not wallet, tokenId)
export function handleRegistrySubscribe(event: Subscribed): void {
  let positionId = event.params.tokenId.toString();
  let owner = event.params.owner;
  
  let position = PositionNFT.load(positionId);
  if (position == null) {
    // Position should exist from PositionUpdated, but create if needed
    let poolId = "0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b";
    let pool = getOrCreatePool(Bytes.fromHexString(poolId));
    position = new PositionNFT(positionId);
    position.pool = poolId;
    position.owner = owner as Bytes;
    position.tickLower = BigInt.fromI32(0);
    position.tickUpper = BigInt.fromI32(0);
    position.liquidity = BigInt.fromI32(0);
    position.createdAtBlock = event.block.number;
    position.createdAtTimestamp = event.block.timestamp;
    position.updatedAtBlock = event.block.number;
    position.updatedAtTimestamp = event.block.timestamp;
    position.feeGrowthInsidePeriod0 = BigInt.fromI32(0);
    position.feeGrowthInsidePeriod1 = BigInt.fromI32(0);
    position.isSubscribed = false;
    position.totalFeeGrowth0 = BigInt.fromI32(0);
    position.totalFeeGrowth1 = BigInt.fromI32(0);
    position.lifetimeBlocks = BigInt.fromI32(0);
    position.classification = "Passive";
    position.modificationCount = 0;
    position.totalRewardsEarned = BigInt.fromI32(0);
  }

  // Create or update subscription
  let subscriptionId = owner.toHexString().concat("-").concat(positionId);
  let subscription = WalletSubscription.load(subscriptionId);
  
  if (subscription == null) {
    subscription = new WalletSubscription(subscriptionId);
    subscription.wallet = owner as Bytes;
    subscription.position = positionId;
    subscription.subscribedAtBlock = event.block.number;
    subscription.subscribedAtTimestamp = event.block.timestamp;
    subscription.isActive = true;
  } else {
    // Re-subscribe
    subscription.subscribedAtBlock = event.block.number;
    subscription.subscribedAtTimestamp = event.block.timestamp;
    subscription.unsubscribedAtBlock = null;
    subscription.unsubscribedAtTimestamp = null;
    subscription.isActive = true;
  }
  
  subscription.save();
  
  position.isSubscribed = true;
  position.save();
}

// Handle Unsubscribed - note: parameter order is tokenId, owner
export function handleRegistryUnsubscribe(event: Unsubscribed): void {
  let positionId = event.params.tokenId.toString();
  let owner = event.params.owner;
  
  let subscriptionId = owner.toHexString().concat("-").concat(positionId);
  let subscription = WalletSubscription.load(subscriptionId);
  
  if (subscription != null) {
    subscription.unsubscribedAtBlock = event.block.number;
    subscription.unsubscribedAtTimestamp = event.block.timestamp;
    subscription.isActive = false;
    subscription.save();
  }
  
  // Check if position has any active subscriptions
  let position = PositionNFT.load(positionId);
  if (position != null) {
    // In a real implementation, we'd check all subscriptions
    // For now, we'll mark as unsubscribed if this was the only subscription
    position.isSubscribed = false;
    position.save();
  }
}

// Handle RewardsClaimed - note: parameter name is "owner" not "wallet"
export function handleRewardsClaimed(event: RewardsClaimed): void {
  let owner = event.params.owner;
  let amount = event.params.amount;
  
  // Track claimed rewards
  // In a full implementation, we'd update a Wallet entity
  // For now, this event is tracked for analytics
  
  // Note: There's no RewardsAdded event - rewards are added via addRewards() function
  // which doesn't emit an event. Rewards are calculated off-chain and added in batches.
}
