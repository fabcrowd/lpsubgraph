# Deploy Your Subgraph - Step by Step

## 🚀 Quick Deployment (5 Steps)

### Step 1: Get Your Deploy Key

1. Go to **https://thegraph.com/studio/**
2. Sign in (or create account if needed)
3. Click **"Create a Subgraph"** or find your existing subgraph
4. Copy your **Deploy Key** (looks like: `QmXxxxxx...` or a long string)

### Step 2: Authenticate

Open PowerShell in this directory and run:

```powershell
npx graph auth --studio YOUR_DEPLOY_KEY_HERE
```

Replace `YOUR_DEPLOY_KEY_HERE` with the key you copied.

**Example:**
```powershell
npx graph auth --studio QmXk5vJ8h9i2L3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f
```

### Step 3: Build (Optional but Recommended)

Make sure everything compiles:

```powershell
npm run build
```

Should see: `Build completed: build\subgraph.yaml` ✅

### Step 4: Deploy

```powershell
npm run deploy
```

**What happens:**
- Subgraph is uploaded to The Graph
- You'll see a URL like: `https://api.studio.thegraph.com/query/.../telx-v4-pool/...`
- Copy this URL!

### Step 5: Wait for Sync & Set URL

1. Go to **https://thegraph.com/studio/**
2. Find your subgraph `telx-v4-pool`
3. Wait for status to show **"Synced"** (10-30 minutes)
4. Copy the **Query URL** from the subgraph page

Then set it in PowerShell:

```powershell
$env:SUBGRAPH_URL="https://api.studio.thegraph.com/query/YOUR_VERSION/telx-v4-pool/YOUR_VERSION"
```

## ✅ Verify It Works

Once synced, test it:

```powershell
# Run live report
npm run query:report

# Or competitive analysis
npm run query:competitive
```

## 🆘 Troubleshooting

### "Deploy key invalid"
- Make sure you copied the full key
- Check you're using `--studio` flag
- Try creating a new subgraph in Graph Studio

### "Subgraph name already taken"
- The name `telx-v4-pool` might be taken
- Either:
  - Use a different name in `package.json` deploy script
  - Or delete the old subgraph in Graph Studio

### "Build failed"
- Run `npm run build` first to see errors
- Check all files are saved
- Make sure you're in the `telx-v4-pool` directory

### "Still syncing after 30 minutes"
- Check the startBlock in `subgraph.yaml` (should be 38000000)
- Verify contract addresses are correct
- Check Graph Studio logs for errors

## 📋 Complete Command Sequence

Copy and paste these commands one by one:

```powershell
# 1. Navigate to project (if not already there)
cd "C:\Users\daroo\Desktop\Telx subgraph\telx-v4-pool"

# 2. Build first
npm run build

# 3. Authenticate (replace with your key)
npx graph auth --studio YOUR_DEPLOY_KEY

# 4. Deploy
npm run deploy

# 5. Wait for sync, then set URL and test
$env:SUBGRAPH_URL="YOUR_SUBGRAPH_URL"
npm run query:report
```

## 🎯 What to Expect

**During deployment:**
```
Deploying to https://api.studio.thegraph.com/deploy/
...
Build completed: build\subgraph.yaml
Deployed to https://api.studio.thegraph.com/query/.../telx-v4-pool/...
```

**After sync:**
- Status shows "Synced" in Graph Studio
- Queries return data
- Live report shows positions

## 📚 Need Help?

- **Graph Studio**: https://thegraph.com/studio/
- **The Graph Docs**: https://thegraph.com/docs/
- **Check logs**: Graph Studio → Your Subgraph → Logs

Good luck! 🚀

