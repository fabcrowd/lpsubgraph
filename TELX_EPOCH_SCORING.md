# TELx Epoch Scoring Integration - Summary

## ✅ What Was Created

### Core Scoring Engine

1. **`src/telx/epochScoring.ts`**
   - `calculateTelxEpoch(config)`: Main scoring function
   - Implements canonical TELx reward calculation logic
   - Reads checkpoints from subgraph for epoch period
   - Calculates fee growth during epoch
   - Applies classification weights (JIT=0%, Active=0%, Passive=100%)
   - Computes weighted scores
   - Distributes rewards pro-rata based on weighted scores

2. **`src/telx/liveSnapshot.ts`**
   - `computeLiveTelxSnapshot(config)`: Live epoch snapshot helper
   - Fetches latest block if endBlock not provided
   - Calls `calculateTelxEpoch` with current block as end
   - Returns `LiveTelxSnapshot` with per-wallet rewards and shares

3. **`config/telxBasePool.ts`**
   - `TELX_BASE_CONFIG`: Configuration for Base v4 pool
   - Placeholders for positionRegistry, poolId, epochStartBlock, epochTotalRewardTel
   - Fill in with actual values before use

### Type Extensions

4. **`src/types.ts`** (Updated)
   - Extended `WalletSummary` with:
     - `liveRewardTelSoFar?: bigint`
     - `liveRewardShare?: number` (0..1)
     - `liveRewardSharePercent?: number` (0..100)

### Integration

5. **`tools/report.ts`** (Updated)
   - Calls `computeLiveTelxSnapshot` before generating report
   - Enriches wallet summaries with live reward data
   - Handles errors gracefully (continues without live data if config not set)

6. **`src/reporting/textReport.ts`** (Updated)
   - Added `formatTel()` helper for formatting TEL amounts
   - Updated "SUMMARY BY WALLET" to include:
     - "Live Reward TEL" column
     - "Live Reward %" column
   - Updated "YOUR POSITIONS SUMMARY" to show:
     - "Live Epoch Rewards (So Far): X TEL (Y% of epoch if ended now)"

---

## 📊 API Reference

### `calculateTelxEpoch`

```typescript
export interface TelxEpochConfig {
  network: 'base';
  positionRegistry: string;
  poolId: string; // v4 PoolId (bytes32 hex string, e.g., "0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b")
  startBlock: number;
  endBlock: number;
  totalRewardTel: bigint; // total TEL budgeted for the epoch (18 decimals)
  subgraphUrl?: string; // optional, defaults to env var
}

export interface TelxEpochResult {
  perWallet: { 
    address: string; 
    rewardTel: bigint; 
    score?: bigint;
    weightedScore?: bigint;
  }[];
  totalScore: bigint;
  totalRewardsDistributed: bigint;
}

export async function calculateTelxEpoch(config: TelxEpochConfig): Promise<TelxEpochResult>
```

### `computeLiveTelxSnapshot`

```typescript
export interface LiveSnapshotConfig extends Omit<TelxEpochConfig, 'endBlock'> {
  endBlock?: number; // optional, will fetch latest if not provided
  rpcUrl?: string; // optional RPC URL for fetching latest block
}

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

export async function computeLiveTelxSnapshot(cfg: LiveSnapshotConfig): Promise<LiveTelxSnapshot>
```

---

## 🔧 Configuration

Edit `config/telxBasePool.ts`:

```typescript
export const TELX_BASE_CONFIG = {
  network: 'base' as const,
  positionRegistry: '0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04', // PositionRegistry address
  poolId: '0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b', // v4 PoolId (bytes32)
  epochStartBlock: 38000000, // Current epoch start block
  epochTotalRewardTel: BigInt('1000000000000000000000'), // 1000 TEL (18 decimals)
  rpcUrl: 'https://mainnet.base.org',
};
```

**Important**: 
- `poolId` should be the v4 PoolId (bytes32 hex string)
- In the subgraph, this is stored as the Pool entity `id` (hex string)
- `epochTotalRewardTel` must be in wei (18 decimals), e.g., `BigInt('1000000000000000000000')` = 1000 TEL

---

## 📈 Scoring Logic

The scoring engine implements the canonical TELx logic:

1. **Fetch Positions**: Queries subgraph for all subscribed positions in the pool
2. **Calculate Fee Growth**: Uses checkpoints to compute fee growth delta during epoch
3. **Apply Classification Weights**:
   - JIT: 0% weight
   - Active: 0% weight
   - Passive: 100% weight
4. **Compute Weighted Scores**: `score = (feeGrowth0 + feeGrowth1) * weight / 100`
5. **Distribute Rewards**: Pro-rata based on weighted scores

**Note**: The current implementation uses a simplified fee growth calculation (sum of feeGrowth0 + feeGrowth1). In production, you'd need token prices to convert to a common denominator (as shown in Excel with `totalFeesCommonDenominator`).

---

## 🚀 Usage

### Basic Usage

```typescript
import { calculateTelxEpoch } from './src/telx/epochScoring';
import { computeLiveTelxSnapshot } from './src/telx/liveSnapshot';
import { TELX_BASE_CONFIG } from './config/telxBasePool';

// Calculate epoch rewards
const result = await calculateTelxEpoch({
  network: 'base',
  positionRegistry: TELX_BASE_CONFIG.positionRegistry,
  poolId: TELX_BASE_CONFIG.poolId,
  startBlock: 38000000,
  endBlock: 38100000,
  totalRewardTel: BigInt('1000000000000000000000') // 1000 TEL
});

// Compute live snapshot (uses latest block)
const snapshot = await computeLiveTelxSnapshot({
  network: 'base',
  positionRegistry: TELX_BASE_CONFIG.positionRegistry,
  poolId: TELX_BASE_CONFIG.poolId,
  startBlock: TELX_BASE_CONFIG.epochStartBlock,
  totalRewardTel: TELX_BASE_CONFIG.epochTotalRewardTel
});
```

### In Report

The report automatically uses live snapshot if config is set:

```bash
npm run report:text
```

The report will show:
- **SUMMARY BY WALLET**: Includes "Live Reward TEL" and "Live Reward %" columns
- **YOUR POSITIONS SUMMARY**: Shows "Live Epoch Rewards (So Far): X TEL (Y% of epoch if ended now)"

---

## ⚠️ Important Notes

1. **Config Must Be Set**: Live rewards only appear if `TELX_BASE_CONFIG` is properly configured
2. **Subgraph Must Be Synced**: Requires checkpoints to be indexed in subgraph
3. **Fee Growth Calculation**: Currently simplified (sum of feeGrowth0 + feeGrowth1). Production should use token prices for common denominator.
4. **PoolId Format**: Must match the Pool entity ID in subgraph (hex string of bytes32)

---

## 🔍 Verification

To verify the scoring is working:

1. Set `TELX_BASE_CONFIG` with actual values
2. Run `npm run report:text`
3. Check that "Live Reward TEL" and "Live Reward %" columns appear
4. Verify rewards match expected distribution based on:
   - Only Passive positions eligible
   - Pro-rata distribution based on weighted scores
   - Total rewards = epochTotalRewardTel (minus rounding)

---

## 📝 Next Steps

1. **Fill in Config**: Update `config/telxBasePool.ts` with actual values
2. **Test Scoring**: Run report and verify live rewards appear
3. **Refine Fee Calculation**: If needed, add token price fetching for accurate common denominator
4. **Compare with Excel**: Verify against known epoch results from Excel files

---

## 🎯 Files Created/Modified

**New Files**:
- `src/telx/epochScoring.ts`
- `src/telx/liveSnapshot.ts`
- `config/telxBasePool.ts`
- `TELX_EPOCH_SCORING.md` (this file)

**Modified Files**:
- `src/types.ts` (extended WalletSummary)
- `tools/report.ts` (wired live snapshot)
- `src/reporting/textReport.ts` (added live reward columns)

