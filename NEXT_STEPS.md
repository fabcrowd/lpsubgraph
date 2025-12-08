# Next Steps & Verification Checklist

## 1. Verify PositionRegistry ABI ✅ IN PROGRESS

**Current Status**: Placeholder ABI created based on expected events

**Action Required**:
1. Visit: https://basescan.org/address/0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04#code
2. Scroll to "Contract ABI" section
3. Copy the full JSON
4. Replace `abis/PositionRegistry.json` with the verified ABI
5. Verify events match:
   - `Checkpoint` event signature
   - `Subscribe` event signature  
   - `Unsubscribe` event signature
   - `RewardsAdded` event signature
   - `RewardsClaimed` event signature

**Alternative**: If you have Basescan API key:
```bash
export BASESCAN_API_KEY=your_key
node tools/fetchPositionRegistryABI.js
```

## 2. Find PositionManager Address ⚠️ NEEDED

**Why**: To track position NFT transfers and get position details (tickLower, tickUpper)

**Where to Look**:
1. **Uniswap v4 Documentation**: Check for standard PositionManager address on Base
2. **TELx Contracts Repo**: Check deployment scripts or config files
3. **Basescan**: Search for "PositionManager" contracts on Base
4. **TELx Team**: Ask for the PositionManager address used

**Potential Address**: `0x498581ff718922c3f8e6a244956af099b2652b2b` (needs verification)

**Once Found**:
- Add PositionManager as a dataSource in `subgraph.yaml`
- Add PositionManager ABI to `abis/PositionManager.json`
- Create mappings for Transfer events to track position ownership changes

## 3. Verify Event Signatures

After getting the actual PositionRegistry ABI, verify these event handlers in `subgraph.yaml`:

```yaml
eventHandlers:
  - event: Checkpoint(indexed uint256,uint128,uint256,uint256,uint256)
    handler: handleCheckpoint
  - event: Subscribe(indexed address,indexed uint256)
    handler: handleRegistrySubscribe
  - event: Unsubscribe(indexed address,indexed uint256)
    handler: handleRegistryUnsubscribe
  - event: RewardsAdded(indexed address,uint256)
    handler: handleRewardsAdded
  - event: RewardsClaimed(indexed address,uint256)
    handler: handleRewardsClaimed
```

Update if signatures don't match.

## 4. Test with Real Data

Once deployed:

1. **Query Your Positions**:
```bash
npm run query:competitive
```

2. **Verify Against Excel**:
   - Compare epoch 16 rewards from Excel vs subgraph
   - Check position IDs match
   - Verify fee growth calculations

3. **Check Classification**:
   - Verify JIT/Active/Passive classification matches expected behavior
   - Test with positions that have different modification patterns

## 5. Enhancements (Optional)

- **Add PositionManager tracking** for complete position lifecycle
- **Add pool metadata** (token0, token1, fee) from events
- **Add price oracle integration** for USD value calculations
- **Add historical epoch comparison** tools
- **Add alerting** for when competitors change positions

## Quick Verification Commands

```bash
# 1. Verify build
npm run build

# 2. Check schema
cat schema.graphql

# 3. Verify ABIs exist
ls -la abis/

# 4. Test queries (after deployment)
npm run query:competitive
npm run query:export
```

## Getting Help

If stuck:
1. Check contract source code in TELx repo
2. Verify events on Basescan transaction logs
3. Compare with Excel epoch data structure
4. Ask TELx team for contract ABIs/addresses

