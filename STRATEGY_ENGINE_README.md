# TELx Strategy Engine - Architecture Guide

## Overview

The TELx strategy engine is a three-layer architecture that transforms raw subgraph data into actionable insights with APR calculations and flexible reporting.

## Architecture

### Layer 1: Data Layer (`src/data/fetchData.ts`)

**Purpose**: Fetches live data from the subgraph and returns structured JSON

**Key Functions**:
- `fetchPoolData()`: Main entry point that queries the subgraph and returns a `PoolSummary` object

**Returns**: `PoolSummary` with:
- All positions (`PositionSummary[]`)
- All wallets (`WalletSummary[]`)
- Pool-level aggregates (total liquidity, rewards, etc.)
- Eligibility and subscription breakdowns

**No business logic** - just data fetching and transformation.

---

### Layer 2: Metrics Layer (`src/metrics/aprEngine.ts`)

**Purpose**: Computes APR estimates and other metrics

**Key Functions**:
- `calculateFeeAPR(position)`: Estimates fee APR based on fee growth and lifetime
- `calculateRewardAPR(position, poolSummary)`: Placeholder for reward APR (to be wired to real TELx scoring)
- `calculateTotalAPR(position, poolSummary)`: Total expected APR (fee + reward)
- `enrichPositionWithAPR(position, poolSummary)`: Adds APR metrics to a position
- `calculateWalletAPR(wallet, poolSummary)`: Calculates aggregated APR for a wallet
- `enrichPoolSummaryWithAPR(poolSummary)`: Adds APR metrics to all positions and wallets

**APR Calculations**:

1. **Fee APR**: 
   - Based on fee growth per block × blocks per year
   - Simplified estimate (real calculation needs token prices)
   - Formula: `(Fee Growth / Lifetime Blocks) * (Blocks Per Year / Liquidity) * 100`

2. **Reward APR** (Placeholder):
   - Currently estimates based on position share of pool
   - Will be replaced with real TELx scoring logic
   - Only applies to eligible (Passive) and subscribed positions

3. **Total APR**: 
   - Sum of Fee APR + Reward APR

**Note**: APR calculations are currently simplified placeholders. The formulas can be iterated on in `aprEngine.ts` without touching other layers.

---

### Layer 3: Reporting Layer

**Text Report** (`src/reporting/textReport.ts`):
- `generateTextReport(poolSummary)`: Prints the original plain text CLI report
- Includes all original columns plus new APR columns
- Maintains the same format you're used to

**JSON Report** (`src/reporting/jsonReport.ts`):
- `generateJSONReport(poolSummary)`: Returns JSON string
- Same data structure, ready for frontend consumption
- Includes all metrics and APR calculations

---

## Type Definitions (`src/types.ts`)

### `PositionSummary`
Core position data with computed metrics:
- Basic info (id, owner, liquidity, ticks, etc.)
- Classification (JIT/Active/Passive)
- Eligibility info
- **APR metrics** (feeAPR, rewardAPR, totalExpectedAPR)

### `WalletSummary`
Aggregated wallet data:
- Total positions, liquidity, rewards
- Classification breakdown
- **APR metrics** (averages and weighted averages)

### `PoolSummary`
Complete pool snapshot:
- All positions and wallets
- Pool-level aggregates
- Eligibility/subscription breakdowns
- Metadata (generatedAt, subgraphUrl, yourWallet)

---

## Usage

### CLI Commands

```bash
# Plain text report (original format + APR columns)
npm run report:text

# JSON output (for frontend/API consumption)
npm run report:json
```

### Programmatic Usage

```typescript
import { fetchPoolData } from "./src/data/fetchData";
import { enrichPoolSummaryWithAPR } from "./src/metrics/aprEngine";
import { generateTextReport } from "./src/reporting/textReport";
import { generateJSONReport } from "./src/reporting/jsonReport";

// Fetch data
const poolData = await fetchPoolData();

// Add APR metrics
const enrichedData = enrichPoolSummaryWithAPR(poolData);

// Generate reports
generateTextReport(enrichedData);  // Print to console
const json = generateJSONReport(enrichedData);  // Get JSON string
```

---

## File Structure

```
telx-v4-pool/
├── src/
│   ├── types.ts                    # TypeScript type definitions
│   ├── data/
│   │   └── fetchData.ts            # Data layer (subgraph queries)
│   ├── metrics/
│   │   └── aprEngine.ts            # Metrics layer (APR calculations)
│   └── reporting/
│       ├── textReport.ts           # Text output
│       └── jsonReport.ts           # JSON output
├── tools/
│   ├── report.ts                   # CLI entry point
│   └── liveReport.ts              # Original report (preserved)
└── package.json                    # Scripts: report:text, report:json
```

---

## Extending the Metrics Layer

To improve APR calculations, edit `src/metrics/aprEngine.ts`:

1. **Fee APR**: Update `calculateFeeAPR()` with real token prices and proper formulas
2. **Reward APR**: Replace `calculateRewardAPR()` with actual TELx scoring logic
3. **Add new metrics**: Create new functions and add them to the enrichment pipeline

The metrics layer is isolated - changes here don't affect data fetching or reporting.

---

## Extending the Reporting Layer

To add new output formats:

1. Create new file in `src/reporting/` (e.g., `csvReport.ts`)
2. Export a function that takes `PoolSummary` and outputs your format
3. Add CLI command in `tools/report.ts`
4. Add npm script in `package.json`

---

## Data Flow

```
Subgraph Query
    ↓
fetchPoolData() → PoolSummary (raw data)
    ↓
enrichPoolSummaryWithAPR() → PoolSummary (with APR metrics)
    ↓
generateTextReport() OR generateJSONReport()
    ↓
Output (console or JSON)
```

---

## Notes

- **Original code preserved**: `tools/liveReport.ts` is unchanged
- **Backward compatible**: `npm run query:report` still works
- **APR calculations are placeholders**: Ready to be replaced with real formulas
- **Type-safe**: Full TypeScript types for all data structures
- **Modular**: Each layer can be modified independently

---

## Next Steps

1. **Improve Fee APR**: Add token price fetching and proper USD-based calculations
2. **Implement Reward APR**: Wire to actual TELx scoring system
3. **Add more metrics**: TVL, risk scores, etc.
4. **Frontend integration**: Use JSON output to build web dashboard

