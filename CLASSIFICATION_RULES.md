# Classification Rules Implementation

## Rules from TELx Documentation

1. **Passive Liquidity** (✅ Rewarded - 100% weight)
   - Definition: You add liquidity and do not modify it more than once in any ~24 hour period
   - Reward Weight: 100%

2. **Active Liquidity** (❌ NO Rewards - 0% weight)
   - Definition: You modify your position (add or remove liquidity) more frequently than once every ~24 hours
   - Reward Weight: 0%
   - The Consequence: If you modify your position, and then modify it again within ~24 hours, the system classifies your behavior as "Active" for that period.

3. **Just-In-Time (JIT) Liquidity** (❌ NO Rewards - 0% weight)
   - Definition: Adding and removing liquidity within the exact same block or very short timeframe
   - Reward Weight: 0%

## Time Thresholds

- **Base**: 43200 blocks (~24 hours)
- **Polygon**: 43200 blocks (~24 hours)

## Current Implementation

The subgraph implements these rules as follows:

### Constants
```typescript
const PASSIVE_THRESHOLD_BLOCKS = BigInt.fromI32(43200); // ~24 hours on Base
const JIT_THRESHOLD_BLOCKS = BigInt.fromI32(1); // Same block
```

### Classification Logic

When a liquidity modification occurs:
1. **Track the modification**: Create a `LiquidityModification` record
2. **Increment modification count**
3. **Check time since last modification**:
   - If `blockDiff <= 1` → **JIT** (same block modifications)
   - Else if `blockDiff < 43200` → **Active** (modified within 24 hours)
   - Else → **Passive** (more than 24 hours between modifications)

### How It Works

- **First modification**: Always classified as "Passive" (no previous modification to compare)
- **Second modification**: 
  - If within 1 block → JIT
  - If within 43200 blocks → Active
  - If more than 43200 blocks → Passive
- **Subsequent modifications**: Same logic applies

### Report Display

The live report shows:
- **Classification**: JIT, Active, or Passive
- **Eligible**: ✅ YES (Passive) or ❌ NO (Active/JIT)
- **Reason**: Explains why each position is/isn't eligible

## Example Scenarios

### Scenario 1: Passive Position
- Block 1000: Add liquidity
- Block 50000: Modify liquidity (49000 blocks later = ~27 hours)
- **Result**: Passive ✅ (eligible for rewards)

### Scenario 2: Active Position
- Block 1000: Add liquidity
- Block 20000: Modify liquidity (19000 blocks later = ~10 hours)
- **Result**: Active ❌ (not eligible for rewards)

### Scenario 3: JIT Position
- Block 1000: Add liquidity
- Block 1000: Remove liquidity (same block)
- **Result**: JIT ❌ (not eligible for rewards)

## Verification

The report correctly:
- ✅ Uses 43200 blocks as the 24-hour threshold
- ✅ Classifies positions as JIT/Active/Passive
- ✅ Shows eligibility based on classification
- ✅ Displays reward weights (100% for Passive, 0% for Active/JIT)

## Note

The current implementation checks the time between **consecutive modifications**. This means:
- If you modify, wait 25 hours, then modify again → Passive ✅
- If you modify, wait 10 hours, then modify again → Active ❌

This matches the rule: "modify your position, and then modify it again within ~24 hours" = Active.

