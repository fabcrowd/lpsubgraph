# Deployment Guide

## Prerequisites

1. **Graph Studio Account**: Sign up at https://thegraph.com/studio/
2. **Deploy Key**: Get your deploy key from Graph Studio
3. **Subgraph Name**: Choose a unique name (e.g., `telx-v4-pool`)

## Step 1: Authenticate

```bash
graph auth --studio <YOUR_DEPLOY_KEY>
```

Replace `<YOUR_DEPLOY_KEY>` with your actual deploy key from Graph Studio.

## Step 2: Deploy

```bash
npm run deploy
```

Or manually:
```bash
npx graph deploy --studio telx-v4-pool
```

## Step 3: Monitor Deployment

1. Go to https://thegraph.com/studio/
2. Find your subgraph
3. Check sync status
4. Wait for indexing to complete (can take 10-30 minutes)

## Step 4: Get Subgraph URL

Once deployed, you'll get a URL like:
```
https://api.studio.thegraph.com/query/<version>/telx-v4-pool/<version>
```

Update `SUBGRAPH_URL` in query tools or set as environment variable:
```bash
export SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../telx-v4-pool/...
```

## Step 5: Verify Deployment

```bash
# Test competitive analysis
npm run query:competitive

# Export positions
npm run query:export

# Verify against Excel
npm run verify:excel
```

## Troubleshooting

### "Subgraph not found"
- Wait for indexing to complete
- Check subgraph URL is correct
- Verify subgraph is deployed and syncing

### "No data returned"
- Subgraph may still be syncing
- Check startBlock in subgraph.yaml (may need to set to actual deployment block)
- Verify contract addresses are correct

### "GraphQL errors"
- Check schema matches subgraph
- Verify query syntax
- Check subgraph logs in Graph Studio

## Local Development (Optional)

For local testing:

```bash
# Start local Graph Node (requires Docker)
docker-compose up

# Deploy to local node
npm run deploy-local

# Query local subgraph
SUBGRAPH_URL=http://localhost:8000/subgraphs/name/telx-v4-pool npm run query:competitive
```

