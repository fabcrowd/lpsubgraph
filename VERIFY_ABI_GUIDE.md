# Quick Guide: How to Verify PositionRegistry ABI

## 🎯 Goal
Get the actual ABI from Basescan and verify it matches our current implementation.

## 📋 Step-by-Step Instructions

### Step 1: Get the ABI from Basescan

1. **Open Basescan**:
   - Go to: https://basescan.org/address/0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04

2. **Find the Contract ABI**:
   - Click the **"Contract"** tab
   - Scroll down to **"Contract ABI"** section
   - You'll see a JSON array

3. **Copy the ABI**:
   - Click the **"Copy"** button (or select all and Ctrl+C)
   - Save it to a file: `new-abi.json` in the project root

### Step 2: Compare ABIs

Run the comparison tool:

```bash
tsx tools/compareABI.ts new-abi.json
```

This will:
- ✅ Show which events match
- ⚠️  Highlight any differences
- 📋 List parameter names and types
- 💡 Give recommendations

### Step 3: Update if Needed

**If ABIs match:**
- ✅ You're good to go! No changes needed.

**If ABIs differ:**
1. Replace the ABI:
   ```bash
   cp new-abi.json abis/PositionRegistry.json
   ```

2. Regenerate types:
   ```bash
   npm run codegen
   ```

3. Check for errors and update handlers if needed:
   ```bash
   npm run build
   ```

## 🔍 What to Look For

The tool will check for these events:
- ✅ `Checkpoint` - Tracks fee growth
- ✅ `Subscribe` - Wallet subscribes to position
- ✅ `Unsubscribe` - Wallet unsubscribes
- ✅ `RewardsAdded` - Rewards distributed (may not exist)
- ✅ `RewardsClaimed` - Rewards claimed (may not exist)

## 🚨 Common Scenarios

### Scenario 1: Events Match
```
✅ Checkpoint: Signatures match
✅ Subscribe: Signatures match
✅ Unsubscribe: Signatures match
```
**Action**: No changes needed!

### Scenario 2: Event Names Differ
```
⚠️  Checkpoint: Not found in new ABI
✅ PositionCheckpoint: Found in new ABI (NEW)
```
**Action**: Update event name in `subgraph.yaml`

### Scenario 3: Parameters Differ
```
⚠️  Subscribe: Signatures differ!
   Current: Subscribe(indexed address,indexed address,uint256)
   New:     Subscribe(indexed address,indexed uint256)
```
**Action**: Update handler in `src/registryMapping.ts`

### Scenario 4: Parameter Names Differ
```
⚠️  Checkpoint: Parameter names differ
   Current: tokenId, liquidity, feeGrowth0, feeGrowth1, blockNumber
   New:     positionId, liquidity, feeGrowth0, feeGrowth1, block
```
**Action**: Update parameter access in handlers (e.g., `event.params.tokenId` → `event.params.positionId`)

## 📝 Manual Verification (Alternative)

If you prefer to check manually:

1. **Open both files**:
   - `abis/PositionRegistry.json` (current)
   - `new-abi.json` (from Basescan)

2. **Find events** (look for `"type": "event"`)

3. **Compare**:
   - Event names
   - Parameter types
   - Indexed parameters (marked with `"indexed": true`)

4. **Check subgraph.yaml**:
   - Event signatures in `eventHandlers` should match
   - Example: `Checkpoint(indexed uint256,uint128,uint256,uint256,uint256)`

## 🆘 Need Help?

If you get stuck:
1. Share the ABI JSON (or screenshot)
2. Share the comparison output
3. I can help update the code

## ✅ Verification Checklist

After comparing:
- [ ] All important events exist
- [ ] Event signatures match
- [ ] Parameter names match (or updated in code)
- [ ] `npm run codegen` succeeds
- [ ] `npm run build` succeeds

Once all checked, you're ready to deploy! 🚀

