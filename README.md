# TELx Uniswap v4 Pool Subgraph

A comprehensive subgraph for tracking TELx Uniswap v4 liquidity positions, rewards, and competitive analysis.

## Overview

This subgraph tracks:
- **Position NFTs** - All liquidity positions by NFT token ID
- **Fee Growth Checkpoints** - Historical fee accumulation per position
- **Wallet Subscriptions** - Which wallets have subscribed to which positions
- **Reward Distributions** - TEL rewards per epoch per wallet
- **Performance Metrics** - JIT/Active/Passive classification based on modification frequency
- **Competitive Analysis** - Compare your positions vs competitors

## Contracts Tracked

### Base Mainnet

- **Pool (TELxIncentiveHook)**: `0x23aB2e6D4Ab0c5f872567098671F1ffb46Fd2500`
- **TELxSubscriber**: `0x735ee950D979C70C14FAa739f80fC96d9893f7ED`
- **PositionRegistry**: `0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04`
- **Pool ID**: `0x727b2741ac2b2df8bc9185e1de972661519fc07b156057eeed9b07c50e08829b`

## Reward Classification System

Positions are classified based on modification frequency:

- **Passive** (100% reward weight): No modifications within 43200 blocks (~24 hours)
- **Active** (0% reward weight): Modifications more than once per 43200 blocks
- **JIT** (0% reward weight): Same block or very short timeframe modifications

## Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- The Graph CLI: `npm install -g @graphprotocol/graph-cli`

### Installation

```bash
npm install
```

### Code Generation

```bash
npm run codegen
```

### Build

```bash
npm run build
```

## Deployment

### Local Development

```bash
# Start local Graph Node (requires Docker)
docker-compose up

# Deploy to local node
npm run deploy-local
```

### Subgraph Studio

```bash
# Authenticate
graph auth --studio <DEPLOY_KEY>

# Deploy
npm run deploy
```

## Query Tools

### Competitive Analysis

Compare your positions against competitors:

```bash
npm run query:competitive
```

This shows:
- Your positions with performance metrics
- Top competitors by liquidity
- Classification breakdown
- Reward totals

### Export All Positions

Export all positions to CSV format:

```bash
npm run query:export
```

Output includes: positionId, owner, tickLower, tickUpper, liquidity, classification, fee growth, rewards, etc.

### Get Epoch Rewards

Query rewards for a specific epoch:

```bash
npm run query:epoch <epochNumber>
```

## GraphQL Queries

### Get All Positions

```graphql
{
  positionNFTs(
    where: { isSubscribed: true }
    orderBy: liquidity
    orderDirection: desc
  ) {
    id
    owner
    tickLower
    tickUpper
    liquidity
    classification
    lifetimeBlocks
    totalFeeGrowth0
    totalFeeGrowth1
    totalRewardsEarned
  }
}
```

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

### Get Position Performance

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
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
    }
  }
}
```

### Get Epoch Rewards

```graphql
{
  rewardDistributions(
    where: { epoch: "16" }
    orderBy: reward
    orderDirection: desc
  ) {
    wallet
    reward
    rewardFormatted
    periodFeesCurrency0Formatted
    periodFeesCurrency1Formatted
  }
}
```

## Schema Entities

### PositionNFT

Tracks each liquidity position by NFT token ID:
- `id`: NFT token ID
- `owner`: Current owner address
- `liquidity`: Current liquidity amount
- `classification`: "JIT", "Active", or "Passive"
- `totalRewardsEarned`: Cumulative TEL rewards
- `checkpoints`: Fee growth history
- `modifications`: Liquidity change history

### FeeGrowthCheckpoint

Historical snapshots of fee growth:
- `blockNumber`: Block when checkpoint was created
- `feeGrowthInside0LastX128`: Fee growth for token0
- `feeGrowthInside1LastX128`: Fee growth for token1
- `liquidity`: Liquidity at checkpoint

### WalletSubscription

Tracks which wallets subscribe to which positions:
- `wallet`: Subscriber address
- `position`: Position NFT ID
- `isActive`: Current subscription status
- `subscribedAtTimestamp`: When subscription started

### RewardDistribution

Tracks TEL rewards per epoch:
- `epoch`: Epoch number
- `wallet`: Recipient address
- `reward`: TEL reward amount
- `periodFeesCurrency0/1`: Fees earned during epoch

## Known Issues / TODO

1. **PositionRegistry ABI**: Current ABI is a placeholder. Need to verify actual events from:
   - https://basescan.org/address/0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04#code
   - Update `abis/PositionRegistry.json` with verified events

2. **PositionManager Address**: Not yet added. Needed to track:
   - Position NFT transfers
   - Position creation events
   - Position details (tickLower, tickUpper, etc.)
   
   To find: Check Uniswap v4 documentation or TELx deployment scripts

3. **Pool Details**: Currently hardcoded pool ID. Should be derived from position data or events.

## Your Wallet

Your wallet address is configured as: `0x0380ad3322Df94334C2f30CEE24D3086FC6F3445`

Update in `tools/competitiveAnalysis.ts` if needed.

## Support

For issues or questions:
- Check The Graph documentation: https://thegraph.com/docs/
- TELx documentation: https://github.com/Telcoin-Association/telcoin-laboratories-contracts

