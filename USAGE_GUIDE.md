# TELx Subgraph - Complete Usage Guide

## 🚀 Quick Start

### 1. Deploy the Subgraph

```bash
# Authenticate (first time only)
graph auth --studio <YOUR_DEPLOY_KEY>

# Deploy
npm run deploy
```

**Get your deploy key**: https://thegraph.com/studio/

### 2. Wait for Sync

- Go to Graph Studio: https://thegraph.com/studio/
- Find your subgraph
- Wait for "Synced" status (10-30 minutes)
- Copy the subgraph URL

### 3. Set Subgraph URL

```bash
# Windows PowerShell
$env:SUBGRAPH_URL="https://api.studio.thegraph.com/query/.../telx-v4-pool/..."

# Or update in tools/competitiveAnalysis.ts
```

## 📊 Available Tools

### Competitive Analysis

Compare your positions vs all competitors:

```bash
npm run query:competitive
```

**Output shows:**
- Your positions with performance metrics
- Top 10 competitors by liquidity
- Classification breakdown (JIT/Active/Passive)
- Total rewards per wallet

### Export All Positions (CSV)

Export all positions to CSV format:

```bash
npm run query:export > positions.csv
```

**Columns:**
- positionId, owner, tickLower, tickUpper, liquidity
- classification, lifetimeBlocks, modificationCount
- totalFeeGrowth0, totalFeeGrowth1
- feeGrowthInsidePeriod0, feeGrowthInsidePeriod1
- totalRewardsEarned, timestamps

### Get Epoch Rewards

Query rewards for a specific epoch:

```bash
npm run query:epoch 16
```

**Shows:**
- All wallets that received rewards
- Reward amounts
- Period fees (currency0 and currency1)
- Total fees common denominator

### Verify Against Excel

Compare subgraph data with Excel epoch file:

```bash
npm run verify:excel
```

**Checks:**
- Position IDs match
- Owner addresses match
- Tick ranges match
- Liquidity amounts match
- Your rewards match Excel data

## 🔍 GraphQL Queries

### Get Your Positions

```graphql
{
  positionNFTs(
    where: {
      subscriptions_: {
        wallet: "0x0380ad3322Df94334C2f30CEE24D3086FC6F3445"
        isActive: true
      }
    }
  ) {
    id
    owner
    tickLower
    tickUpper
    liquidity
    classification
    totalRewardsEarned
    checkpoints(orderBy: blockNumber, orderDirection: desc, first: 10) {
      blockNumber
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
    }
  }
}
```

### Get Top Positions by Liquidity

```graphql
{
  positionNFTs(
    orderBy: liquidity
    orderDirection: desc
    first: 20
    where: { isSubscribed: true }
  ) {
    id
    owner
    liquidity
    classification
    totalRewardsEarned
  }
}
```

### Get Position Performance Over Time

```graphql
{
  positionNFT(id: "96439") {
    id
    owner
    liquidity
    classification
    modifications(orderBy: blockNumber) {
      blockNumber
      timestamp
      newLiquidityAmount
    }
    checkpoints(orderBy: blockNumber) {
      blockNumber
      timestamp
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
    }
  }
}
```

### Get All Passive Positions

```graphql
{
  positionNFTs(
    where: { 
      classification: "Passive"
      isSubscribed: true
    }
    orderBy: liquidity
    orderDirection: desc
  ) {
    id
    owner
    liquidity
    lifetimeBlocks
    totalRewardsEarned
  }
}
```

## 📈 Understanding the Data

### Position Classification

- **Passive**: No modifications within 43200 blocks (~24 hours) → 100% reward weight
- **Active**: Modifications more than once per 43200 blocks → 0% reward weight
- **JIT**: Same block or very short timeframe → 0% reward weight

### Key Metrics

- **liquidity**: Current liquidity amount in the position
- **totalFeeGrowth0/1**: Cumulative fee growth (from all checkpoints)
- **feeGrowthInsidePeriod0/1**: Fee growth during specific epoch period
- **lifetimeBlocks**: How long position has existed
- **modificationCount**: Number of times liquidity was modified
- **totalRewardsEarned**: Cumulative TEL rewards earned

### Checkpoints

Each checkpoint represents a snapshot of:
- Fee growth at that block
- Liquidity at that block
- Used to calculate rewards per epoch

## 🛠️ Troubleshooting

### "Subgraph not available"

**Cause**: Subgraph not deployed or still syncing

**Fix**:
1. Check Graph Studio for deployment status
2. Wait for sync to complete
3. Verify SUBGRAPH_URL is correct

### "No positions found"

**Cause**: 
- Subgraph hasn't indexed enough blocks yet
- startBlock in subgraph.yaml is too high
- Contract addresses incorrect

**Fix**:
1. Check subgraph sync status
2. Verify startBlock is set correctly (0 or actual deployment block)
3. Check contract addresses match Basescan

### "GraphQL errors"

**Cause**: Query syntax error or schema mismatch

**Fix**:
1. Check query syntax
2. Verify field names match schema
3. Check subgraph logs in Graph Studio

## 📝 Example Workflow

### Daily Monitoring

```bash
# 1. Check your positions
npm run query:competitive

# 2. Export for analysis
npm run query:export > daily-positions.csv

# 3. Check specific epoch rewards
npm run query:epoch 16
```

### Weekly Verification

```bash
# Compare with Excel epoch file
npm run verify:excel
```

### Competitive Research

```bash
# Get top competitors
npm run query:competitive

# Export all for deeper analysis
npm run query:export > all-positions.csv
```

## 🎯 Your Wallet

Your wallet is configured as: `0x0380ad3322Df94334C2f30CEE24D3086FC6F3445`

To change it, update `YOUR_WALLET` in:
- `tools/competitiveAnalysis.ts`
- `tools/verifyAgainstExcel.ts`

## 📚 Additional Resources

- **Graph Studio**: https://thegraph.com/studio/
- **GraphQL Playground**: Use in Graph Studio to test queries
- **The Graph Docs**: https://thegraph.com/docs/
- **TELx Contracts**: https://github.com/Telcoin-Association/telcoin-laboratories-contracts

