import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";
import { Subscribe, Unsubscribe, UpdateSubscription } from "../generated/Subscriber/Subscriber";
import { WalletPoolSubscription, Pool } from "../generated/schema";

export function handleSubscribe(event: Subscribe): void {
  let poolId = event.params.pool.toHexString();
  let wallet = event.params.wallet;
  
  // Ensure pool exists
  let pool = Pool.load(poolId);
  if (pool == null) {
    pool = new Pool(poolId);
    pool.token0 = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    pool.token1 = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    pool.fee = 0;
    pool.currentTick = BigInt.fromI32(0);
    pool.save();
  }
  
  // Create subscription ID: wallet-pool
  let subscriptionId = wallet.toHexString().concat("-").concat(poolId);
  let subscription = WalletPoolSubscription.load(subscriptionId);
  
  if (subscription == null) {
    subscription = new WalletPoolSubscription(subscriptionId);
    subscription.wallet = wallet as Bytes;
    subscription.pool = poolId;
    subscription.subscribed = true;
    subscription.liquidityBps = event.params.liquidityBps;
    subscription.createdAtBlock = event.block.number;
    subscription.updatedAtBlock = event.block.number;
  } else {
    subscription.subscribed = true;
    subscription.liquidityBps = event.params.liquidityBps;
    subscription.updatedAtBlock = event.block.number;
  }
  
  subscription.save();
}

export function handleUnsubscribe(event: Unsubscribe): void {
  let poolId = event.params.pool.toHexString();
  let wallet = event.params.wallet;
  
  // Create subscription ID: wallet-pool
  let subscriptionId = wallet.toHexString().concat("-").concat(poolId);
  let subscription = WalletPoolSubscription.load(subscriptionId);
  
  if (subscription == null) {
    subscription = new WalletPoolSubscription(subscriptionId);
    subscription.wallet = wallet as Bytes;
    subscription.pool = poolId;
    subscription.subscribed = false;
    subscription.liquidityBps = BigInt.fromI32(0);
    subscription.createdAtBlock = event.block.number;
    subscription.updatedAtBlock = event.block.number;
  } else {
    subscription.subscribed = false;
    subscription.updatedAtBlock = event.block.number;
  }
  
  subscription.save();
}

export function handleUpdateSubscription(event: UpdateSubscription): void {
  let poolId = event.params.pool.toHexString();
  let wallet = event.params.wallet;
  
  // Create subscription ID: wallet-pool
  let subscriptionId = wallet.toHexString().concat("-").concat(poolId);
  let subscription = WalletPoolSubscription.load(subscriptionId);
  
  if (subscription == null) {
    subscription = new WalletPoolSubscription(subscriptionId);
    subscription.wallet = wallet as Bytes;
    subscription.pool = poolId;
    subscription.subscribed = true;
    subscription.liquidityBps = event.params.liquidityBps;
    subscription.createdAtBlock = event.block.number;
    subscription.updatedAtBlock = event.block.number;
  } else {
    subscription.liquidityBps = event.params.liquidityBps;
    subscription.updatedAtBlock = event.block.number;
  }
  
  subscription.save();
}

