# Step-by-Step Deployment Instructions

## 🚀 Complete Deployment Guide for TELx Subgraph

### Prerequisites Checklist
- [x] Subgraph code is ready (✅ Build successful)
- [x] You have a Graph Studio account
- [x] You have your deploy key: `2494ca5e47be8b2680f059ee9b4a0f83`

---

## Step 1: Create/Configure Subgraph in Graph Studio

1. **Go to Graph Studio**
   - Open: https://thegraph.com/studio/
   - Sign in with your account

2. **Create New Subgraph (if needed)**
   - Click **"Create a Subgraph"** button
   - Or select your existing subgraph if you already created one

3. **Configure Subgraph Details**
   - **Display Name**: `TELx` (or your preferred name)
   - **Subgraph Description**: `TELx Uniswap v4 Pool - Tracks all LP positions, rewards, and competitive analysis`
   - **Source Code URL**: (optional) Your GitHub repo if public
   - **Website URL**: (optional) https://www.telx.network/
   - **Categories**: Select relevant ones:
     - ✅ **DeFi**
     - ✅ **DEX**
     - ✅ **Yield**
   - Click **"Save"**

4. **Select Network**
   - In the "Getting Started" section, select **"Base"** from the network dropdown

---

## Step 2: Authenticate with Your Deploy Key

Open PowerShell in your project directory:

```powershell
# Navigate to project (if not already there)
cd "C:\Users\daroo\Desktop\Telx subgraph\telx-v4-pool"

# Authenticate using your deploy key
# Note: This version of graph-cli uses a different syntax
# Try this command:
npx graph auth https://api.studio.thegraph.com/deploy/ 2494ca5e47be8b2680f059ee9b4a0f83
```

**If that doesn't work**, try:

```powershell
# Alternative method - set as environment variable
$env:GRAPH_STUDIO_API_KEY="2494ca5e47be8b2680f059ee9b4a0f83"
```

**Or** use the authentication method shown in Graph Studio:
- Copy the exact command from Step 4 in Graph Studio
- It might look like: `graph auth --studio <token>`
- But since `--studio` flag doesn't work, use the URL method above

---

## Step 3: Verify Build

Make sure everything compiles:

```powershell
npm run build
```

**Expected output:**
```
√ Compile subgraph
Build completed: build\subgraph.yaml
```

If you see errors, fix them before deploying.

---

## Step 4: Deploy to Studio

```powershell
npm run deploy
```

**What to expect:**
```
Deploying to https://api.studio.thegraph.com/deploy/
...
Build completed: build\subgraph.yaml
Deployed to https://api.studio.thegraph.com/query/<version>/telx-v4-pool/<version>
```

**Important:** Copy the URL that appears! You'll need it in Step 6.

---

## Step 5: Monitor Deployment in Graph Studio

1. **Go back to Graph Studio**
   - Refresh the page: https://thegraph.com/studio/
   - Find your subgraph `telx-v4-pool` (or whatever name you used)

2. **Check Status**
   - You'll see status: **"Syncing"** or **"Pending"**
   - Wait for it to change to **"Synced"**
   - This takes **10-30 minutes** typically

3. **Watch the Progress**
   - You can see:
     - Current block being indexed
     - Total blocks to sync
     - Estimated time remaining

4. **Check for Errors**
   - Click on your subgraph
   - Check the **"Logs"** tab for any errors
   - If you see errors, note them down

---

## Step 6: Get Your Subgraph URL

Once status shows **"Synced"**:

1. **In Graph Studio**, click on your subgraph
2. Go to the **"Query"** or **"Playground"** tab
3. **Copy the Query URL** - it looks like:
   ```
   https://api.studio.thegraph.com/query/<version>/telx-v4-pool/<version>
   ```

**OR** find it in the subgraph details page under "Endpoints"

---

## Step 7: Set Subgraph URL and Test

In PowerShell:

```powershell
# Set the subgraph URL (replace with your actual URL)
$env:SUBGRAPH_URL="https://api.studio.thegraph.com/query/YOUR_VERSION/telx-v4-pool/YOUR_VERSION"

# Test the live report
npm run query:report
```

**Expected output:**
```
====================================================================================================
TELx UNISWAP V4 POOL - LIVE POSITION REPORT
====================================================================================================
📊 Total Positions: 65
💰 Total Reward Distributions: 21
...
```

If you see data, **deployment is successful!** 🎉

---

## Step 8: Make URL Permanent (Optional)

To avoid setting the URL every time, create a `.env` file:

```powershell
# Create .env file
echo "SUBGRAPH_URL=https://api.studio.thegraph.com/query/YOUR_VERSION/telx-v4-pool/YOUR_VERSION" > .env
```

Then update your tools to read from `.env` (or just remember to set it each session).

---

## 🆘 Troubleshooting

### Problem: "Deploy key invalid" or "Authentication failed"

**Solution:**
1. Double-check your deploy key in Graph Studio
2. Make sure you're using the correct URL format
3. Try copying the exact auth command from Graph Studio
4. If using environment variable, make sure it's set correctly

### Problem: "Subgraph name already taken"

**Solution:**
1. Either delete the old subgraph in Graph Studio
2. Or change the name in `package.json`:
   ```json
   "deploy": "graph deploy --node https://api.studio.thegraph.com/deploy/ your-new-name"
   ```

### Problem: "Build failed"

**Solution:**
1. Run `npm run build` first to see errors
2. Fix any TypeScript/compilation errors
3. Make sure all files are saved
4. Try `npm run codegen` then `npm run build`

### Problem: "Still syncing after 30 minutes"

**Solution:**
1. Check the startBlock in `subgraph.yaml` (should be 38000000)
2. Verify contract addresses are correct
3. Check Graph Studio logs for errors
4. If errors, fix and redeploy

### Problem: "No data returned" after sync

**Solution:**
1. Check that contracts have events in the block range
2. Verify startBlock isn't too high
3. Check Graph Studio logs
4. Try querying in Graph Studio Playground first

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Subgraph shows "Synced" status in Graph Studio
- [ ] Query URL is accessible
- [ ] `npm run query:report` returns data
- [ ] Positions are showing up
- [ ] No errors in Graph Studio logs

---

## 📋 Quick Command Reference

```powershell
# 1. Navigate to project
cd "C:\Users\daroo\Desktop\Telx subgraph\telx-v4-pool"

# 2. Authenticate
npx graph auth https://api.studio.thegraph.com/deploy/ 2494ca5e47be8b2680f059ee9b4a0f83

# 3. Build
npm run build

# 4. Deploy
npm run deploy

# 5. Set URL (after sync)
$env:SUBGRAPH_URL="YOUR_URL_HERE"

# 6. Test
npm run query:report
```

---

## 🎯 Next Steps After Deployment

Once deployed and synced:

1. **Run Live Report**
   ```powershell
   npm run query:report
   ```

2. **Export Positions**
   ```powershell
   npm run query:export > positions.csv
   ```

3. **Competitive Analysis**
   ```powershell
   npm run query:competitive
   ```

4. **Verify Against Excel**
   ```powershell
   npm run verify:excel
   ```

---

## 📚 Additional Resources

- **Graph Studio**: https://thegraph.com/studio/
- **The Graph Docs**: https://thegraph.com/docs/
- **Your Subgraph**: Check Graph Studio for logs and status

---

## 🎉 You're Ready!

Follow these steps in order, and you'll have your subgraph deployed and working. Good luck! 🚀

