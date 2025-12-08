# How to Verify PositionRegistry ABI

## Method 1: Manual Verification (Recommended)

### Step 1: Open Basescan
1. Go to: https://basescan.org/address/0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04
2. Click on the **"Contract"** tab
3. Scroll down to find **"Contract ABI"** section

### Step 2: Copy the ABI
1. Click the **"Copy"** button next to "Contract ABI" (or select all and copy)
2. The ABI is a JSON array - it should start with `[` and end with `]`

### Step 3: Compare with Current ABI
1. Open `abis/PositionRegistry.json` in your editor
2. Compare the events - look for these event names:
   - `Checkpoint`
   - `Subscribe` 
   - `Unsubscribe`
   - `RewardsAdded`
   - `RewardsClaimed`

### Step 4: Check Event Signatures
For each event, verify the parameters match. For example:

**Checkpoint event should have:**
- `tokenId` (indexed uint256)
- `liquidity` (uint128)
- `feeGrowthInside0LastX128` (uint256)
- `feeGrowthInside1LastX128` (uint256)
- `blockNumber` (uint256)

### Step 5: Update if Needed
If the events don't match:
1. Replace `abis/PositionRegistry.json` with the copied ABI
2. Run `npm run codegen` to regenerate types
3. Update event handlers in `subgraph.yaml` if signatures changed
4. Update handlers in `src/registryMapping.ts` if parameter names changed

## Method 2: Using Basescan API (If you have API key)

### Step 1: Get API Key
1. Go to: https://basescan.org/apis
2. Sign up for free API key
3. Copy your API key

### Step 2: Run Fetch Script
```bash
export BASESCAN_API_KEY=your_api_key_here
node tools/fetchPositionRegistryABI.js
```

This will automatically:
- Fetch the ABI from Basescan
- Save it to `abis/PositionRegistry.json`
- Show you all events found

### Step 3: Verify Events
Check the output to see if these events exist:
- Checkpoint
- Subscribe
- Unsubscribe
- RewardsAdded
- RewardsClaimed

## Method 3: Check Transaction Logs

### Step 1: Find Recent Transactions
1. On Basescan contract page, go to **"Transactions"** tab
2. Find a recent transaction that interacted with PositionRegistry
3. Click on the transaction

### Step 2: Check Event Logs
1. Scroll to **"Event Logs"** section
2. Look for events emitted by PositionRegistry
3. Check the event signatures match what we expect

### Step 3: Decode Events
1. Click on an event to see decoded parameters
2. Verify parameter names and types match our ABI

## Quick Verification Checklist

After getting the ABI, verify:

- [ ] `Checkpoint` event exists
- [ ] `Subscribe` event exists  
- [ ] `Unsubscribe` event exists
- [ ] `RewardsAdded` event exists (optional - may not exist if rewards are added differently)
- [ ] `RewardsClaimed` event exists (optional)
- [ ] Event parameter types match (uint256, address, etc.)
- [ ] Indexed parameters are marked correctly

## If Events Don't Match

If the actual events are different:

1. **Update subgraph.yaml** - Change event signatures in eventHandlers
2. **Update registryMapping.ts** - Adjust parameter access (e.g., `event.params.tokenId` vs `event.params.positionId`)
3. **Run codegen** - `npm run codegen` to regenerate types
4. **Test build** - `npm run build` to verify it compiles

## Common Issues

**Issue**: Event name is different (e.g., `PositionCheckpoint` instead of `Checkpoint`)
**Fix**: Update event name in `subgraph.yaml` and handler function name

**Issue**: Parameters are in different order
**Fix**: Update parameter access in mapping handlers

**Issue**: Some events don't exist
**Fix**: Remove those event handlers from `subgraph.yaml` if not needed

## Need Help?

If you're stuck:
1. Share the ABI JSON (or screenshot of events section)
2. I can help compare and update the code
3. Or share a transaction hash that shows the events being emitted

