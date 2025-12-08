# Graph Studio Setup - Step by Step

## The Issue
Graph Studio requires you to **create the subgraph entry** in their UI before you can deploy to it.

## Solution: Create Subgraph in Graph Studio UI

### Step 1: Go to Graph Studio
1. Open: https://thegraph.com/studio/
2. Make sure you're logged in

### Step 2: Create New Subgraph
1. Click **"Create a Subgraph"** button (or "Add Subgraph")
2. You'll see a form to fill in

### Step 3: Fill in Subgraph Details
- **Display Name**: `telx-v4-pool` (or `TELx`)
- **Subgraph Description**: `TELx Uniswap v4 Pool - Tracks LP positions and rewards`
- **Network**: Select **"Base"** from dropdown
- **Categories**: Select DeFi, DEX, Yield (optional)
- Click **"Save"** or **"Create"**

### Step 4: After Creating
Once you click Save, Graph Studio will:
- Create the subgraph entry
- Show you the subgraph dashboard
- Now you can deploy to it!

### Step 5: Deploy from Command Line
Now go back to PowerShell and run:

```powershell
npm run deploy
```

When prompted for version, enter: `v0.0.1`

---

## Alternative: If Graph Studio Shows "Initialize" Button

If Graph Studio is showing you an "Initialize" button or asking you to initialize:

1. **Click "Initialize"** - This just creates the subgraph entry in their system
2. **Fill in the form** that appears
3. **Save it**
4. Then deploy from command line

The "Initialize" in Graph Studio UI is different from `graph init` command - it's just creating the subgraph entry.

---

## What "Initialize" Means in Graph Studio

In Graph Studio UI:
- **"Initialize"** = Create the subgraph entry in their database
- This is NOT the same as `graph init` command
- You just need to create the entry, then deploy your existing code

---

## Quick Checklist

- [ ] Go to https://thegraph.com/studio/
- [ ] Click "Create a Subgraph" or "Initialize"
- [ ] Fill in: Name, Description, Network (Base)
- [ ] Click "Save"
- [ ] Go back to PowerShell
- [ ] Run `npm run deploy`
- [ ] Enter version `v0.0.1`

---

## After Deployment

Once deployed successfully:
1. Go back to Graph Studio
2. Find your subgraph
3. Wait for it to sync (10-30 minutes)
4. Copy the Query URL
5. Set it: `$env:SUBGRAPH_URL="YOUR_URL"`
6. Test: `npm run query:report`

