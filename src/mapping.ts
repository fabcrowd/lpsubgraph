import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";
import { ModifyLiquidity, Swap } from "../generated/Pool/Pool";
import { Pool, Position } from "../generated/schema";

export function handleModifyLiquidity(event: ModifyLiquidity): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  
  // Ensure pool exists
  if (pool == null) {
    pool = new Pool(poolId);
    pool.token0 = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    pool.token1 = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    pool.fee = 0;
    pool.currentTick = BigInt.fromI32(0);
    pool.save();
  }
  
  // Create position ID: pool-owner-tickLower-tickUpper
  let positionId = poolId
    .concat("-")
    .concat(event.params.owner.toHexString())
    .concat("-")
    .concat(event.params.tickLower.toString())
    .concat("-")
    .concat(event.params.tickUpper.toString());
  
  let position = Position.load(positionId);
  
  if (position == null) {
    position = new Position(positionId);
    position.pool = poolId;
    position.owner = event.params.owner as Bytes;
    position.tickLower = BigInt.fromI32(event.params.tickLower);
    position.tickUpper = BigInt.fromI32(event.params.tickUpper);
    position.liquidity = event.params.liquidityDelta;
    position.createdAtBlock = event.block.number;
    position.updatedAtBlock = event.block.number;
  } else {
    position.liquidity = position.liquidity.plus(event.params.liquidityDelta);
    position.updatedAtBlock = event.block.number;
  }
  
  position.save();
}

export function handleSwap(event: Swap): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  
  if (pool == null) {
    pool = new Pool(poolId);
    pool.token0 = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    pool.token1 = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    pool.fee = 0;
    pool.currentTick = BigInt.fromI32(event.params.tick);
  } else {
    pool.currentTick = BigInt.fromI32(event.params.tick);
  }
  
  pool.save();
}

