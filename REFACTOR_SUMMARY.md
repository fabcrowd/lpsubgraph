# Strategy Engine Refactor - Summary

## ✅ What Was Created

### New Files Created

1. **`src/types.ts`**
   - TypeScript type definitions
   - `PositionSummary`, `WalletSummary`, `PoolSummary` interfaces
   - Includes APR metric fields

2. **`src/data/fetchData.ts`**
   - Data layer: Fetches from subgraph
   - `fetchPoolData()`: Returns structured `PoolSummary`
   - No business logic, just data transformation

3. **`src/metrics/aprEngine.ts`**
   - Metrics layer: APR calculations
   - `calculateFeeAPR()`: Fee APR estimate
   - `calculateRewardAPR()`: Reward APR placeholder (ready for TELx scoring)
   - `calculateTotalAPR()`: Total expected APR
   - `enrichPoolSummaryWithAPR()`: Adds APR to all positions/wallets

4. **`src/reporting/textReport.ts`**
   - Text output (original format + APR columns)
   - `generateTextReport()`: Prints to console

5. **`src/reporting/jsonReport.ts`**
   - JSON output for frontend
   - `generateJSONReport()`: Returns JSON string

6. **`tools/report.ts`**
   - CLI entry point
   - Handles `text` or `json` output format

7. **`STRATEGY_ENGINE_README.md`**
   - Complete architecture documentation

### Files Modified

1. **`package.json`**
   - Added: `npm run report:text`
   - Added: `npm run report:json`

### Files Preserved

- **`tools/liveReport.ts`** - Original report code (unchanged)
- All other existing files remain intact

---

## 🎯 Architecture

```
┌─────────────────────────────────────────┐
│         CLI Entry Point                  │
│      tools/report.ts                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Data Layer                      │
│    src/data/fetchData.ts                │
│    - Fetches from subgraph              │
│    - Returns PoolSummary                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Metrics Layer                    │
│    src/metrics/aprEngine.ts              │
│    - Calculates Fee APR                  │
│    - Calculates Reward APR (placeholder) │
│    - Calculates Total APR                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Reporting Layer                  │
│    src/reporting/textReport.ts          │
│    src/reporting/jsonReport.ts          │
│    - Text output (console)              │
│    - JSON output (stdout)                │
└─────────────────────────────────────────┘
```

---

## 📊 New Features

### APR Metrics

**Per Position**:
- `feeAPR`: Estimated fee APR based on fee growth
- `rewardAPR`: Placeholder for TELx reward APR
- `totalExpectedAPR`: Fee APR + Reward APR

**Per Wallet**:
- `averageFeeAPR`: Simple average across positions
- `averageRewardAPR`: Simple average
- `averageTotalAPR`: Simple average
- `weightedAverageFeeAPR`: Liquidity-weighted average
- `weightedAverageRewardAPR`: Liquidity-weighted average
- `weightedAverageTotalAPR`: Liquidity-weighted average

### Output Formats

1. **Text Report** (`npm run report:text`):
   - Original format preserved
   - Added APR columns
   - All original data + new metrics

2. **JSON Report** (`npm run report:json`):
   - Complete data structure
   - Ready for frontend consumption
   - Includes all metrics and APR calculations

---

## 🚀 Usage

### CLI Commands

```bash
# Plain text report (original + APR)
npm run report:text

# JSON output
npm run report:json

# Original report (still works)
npm run query:report
```

### Programmatic Usage

```typescript
import { fetchPoolData } from "./src/data/fetchData";
import { enrichPoolSummaryWithAPR } from "./src/metrics/aprEngine";
import { generateTextReport } from "./src/reporting/textReport";

const data = await fetchPoolData();
const enriched = enrichPoolSummaryWithAPR(data);
generateTextReport(enriched);
```

---

## 📝 APR Calculation Notes

### Current Implementation (Placeholders)

**Fee APR**:
- Simplified calculation based on fee growth rate
- Formula: `(Fee Growth / Lifetime Blocks) * (Blocks Per Year / Liquidity) * 100`
- **Note**: This is a placeholder. Real calculation needs:
  - Token prices (USD)
  - Position value in USD
  - More sophisticated fee growth calculations

**Reward APR**:
- Placeholder based on position share of pool
- **Note**: Will be replaced with real TELx scoring logic
- Currently only applies to eligible (Passive) positions

### Next Steps for APR

1. **Fee APR**: Add token price fetching and USD-based calculations
2. **Reward APR**: Wire to actual TELx scoring system
3. **Refine formulas**: Iterate on calculations in `aprEngine.ts`

---

## ✅ Verification

- ✅ Text report works (`npm run report:text`)
- ✅ JSON report works (`npm run report:json`)
- ✅ Original report preserved (`npm run query:report`)
- ✅ APR columns added to text output
- ✅ All types defined
- ✅ Three-layer architecture implemented
- ✅ Modular and extensible

---

## 📁 File Structure

```
telx-v4-pool/
├── src/
│   ├── types.ts                    # ✅ NEW - Type definitions
│   ├── data/
│   │   └── fetchData.ts            # ✅ NEW - Data layer
│   ├── metrics/
│   │   └── aprEngine.ts            # ✅ NEW - APR calculations
│   └── reporting/
│       ├── textReport.ts           # ✅ NEW - Text output
│       └── jsonReport.ts           # ✅ NEW - JSON output
├── tools/
│   ├── report.ts                   # ✅ NEW - CLI entry point
│   └── liveReport.ts               # ✅ PRESERVED - Original code
└── STRATEGY_ENGINE_README.md      # ✅ NEW - Documentation
```

---

## 🎉 Ready to Use!

The strategy engine is ready. You can:

1. **Use the new reports**: `npm run report:text` or `npm run report:json`
2. **Iterate on APR**: Edit `src/metrics/aprEngine.ts` without touching other layers
3. **Add new metrics**: Extend the metrics layer
4. **Add new outputs**: Extend the reporting layer
5. **Use programmatically**: Import and use in your own code

All original functionality is preserved and enhanced! 🚀

