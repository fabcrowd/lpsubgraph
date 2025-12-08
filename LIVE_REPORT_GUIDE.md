# Live Report Tool - Complete Guide

## ✅ What the Tool Does

The **Live Report** tool (`npm run query:report`) provides a comprehensive real-time dashboard showing:

### 1. ✅ **All Positions**
- Every position in the pool
- Sorted by liquidity (highest first)
- Shows position ID, owner, tick ranges, liquidity

### 2. ✅ **Percentage of Rewards**
- **Liquidity %**: Each position's share of total pool liquidity
- **Reward %**: Each position's share of total rewards distributed
- **Wallet-level %**: Aggregated percentages per wallet

### 3. ✅ **Fees**
- **Total Fee Growth 0**: Cumulative fees in token0
- **Total Fee Growth 1**: Cumulative fees in token1
- **Period Fees**: Fees during specific epoch periods
- **Fee percentages**: Each position's share of total fees

### 4. ✅ **Rewards Eligibility**
- **✅ Eligible (Passive)**: 100% reward weight
- **❌ Ineligible (Active)**: 0% reward weight (modified too frequently)
- **❌ Ineligible (JIT)**: 0% reward weight (same block modifications)
- Shows eligibility reason for each position

### 5. ✅ **Subscription Status**
- **✅ Subscribed**: Position is actively subscribed
- **❌ Not Subscribed**: Position exists but not subscribed
- Shows subscription count per wallet

## 🚀 How to Use

### Step 1: Deploy Subgraph

```bash
graph auth --studio <YOUR_DEPLOY_KEY>
npm run deploy
```

### Step 2: Wait for Sync

- Go to Graph Studio
- Wait for "Synced" status
- Copy subgraph URL

### Step 3: Set Subgraph URL

```bash
# Windows PowerShell
$env:SUBGRAPH_URL="https://api.studio.thegraph.com/query/.../telx-v4-pool/..."
```

### Step 4: Run Live Report

```bash
npm run query:report
```

## 📊 Report Output

The report shows:

### 1. **All Positions Table**
```
Position ID  Owner                                    Liquidity         Liq %    Classification  Eligible  Subscribed  Fees 0         Fees 1         Rewards        Reward %
96439        0x55a09787C9CE8E0be3b4132acca7De895303B9AB  70340928853837   15.23%   Passive        ✅ YES    ✅ YES      0.006638      3279.24        1250.50       2.75%
98826        0xe3B1ebcD19c28459aD75B44C13095cA93E53cbB0  2799647519312    0.61%    Active         ❌ NO     ✅ YES      0.000264      130.51         0.00          0.00%
```

**Columns:**
- **Position ID**: NFT token ID
- **Owner**: Wallet address (★ marks your positions)
- **Liquidity**: Current liquidity amount
- **Liq %**: Percentage of total pool liquidity
- **Classification**: JIT/Active/Passive
- **Eligible**: ✅ YES (Passive) or ❌ NO (Active/JIT)
- **Subscribed**: ✅ YES or ❌ NO
- **Fees 0/1**: Fee growth amounts
- **Rewards**: Total TEL rewards earned
- **Reward %**: Percentage of total rewards

### 2. **Summary by Wallet**
```
Rank  Owner                                    Positions  Total Liquidity  Liq %    Passive  Active  JIT     Subscribed  Total Rewards  Reward %
1     0x55a09787C9CE8E0be3b4132acca7De895303B9AB  3         75000000000000   16.25%   2        1       0       3           2500.00       5.50%
2     ★ 0x0380ad3322Df94334C2f30CEE24D3086FC6F3445  2         50000000000000   10.83%   2        0       0       2           45461.73      100.00%
```

Shows aggregated stats per wallet with your wallet marked with ★.

### 3. **Your Positions Summary**
```
YOUR POSITIONS SUMMARY
Total Positions: 2
Total Liquidity: 50,000,000,000,000 (10.83% of pool)
Total Rewards Earned: 45,461.73 TEL (100.00% of total)
Passive Positions: 2 (100.00% eligible)
Active Positions: 0 (0% eligible)
JIT Positions: 0 (0% eligible)
Subscribed Positions: 2/2
Total Fee Growth 0: 0.014588631912459892
Total Fee Growth 1: 7,206.54
```

### 4. **Eligibility Breakdown**
```
REWARDS ELIGIBILITY BREAKDOWN
✅ Eligible (Passive): 45 (69.23%)
❌ Ineligible (Active/JIT): 20 (30.77%)
📊 Total Positions: 65
```

### 5. **Subscription Status**
```
SUBSCRIPTION STATUS
✅ Subscribed: 60 (92.31%)
❌ Not Subscribed: 5 (7.69%)
```

## 📈 Key Metrics Explained

### Liquidity Percentage
Shows what % of total pool liquidity each position represents. Higher = more fees earned.

### Reward Percentage
Shows what % of total rewards each position/wallet has earned. Based on:
- Fee growth during epoch
- Classification (Passive = 100%, Active/JIT = 0%)
- Subscription status

### Eligibility
- **Passive**: No modifications within 43200 blocks → ✅ Eligible (100%)
- **Active**: Modifications within 43200 blocks → ❌ Ineligible (0%)
- **JIT**: Same block modifications → ❌ Ineligible (0%)

### Subscription Status
- **Subscribed**: Wallet has actively subscribed to position → Can earn rewards
- **Not Subscribed**: Position exists but wallet hasn't subscribed → No rewards

## 🔄 Running Regularly

For real-time monitoring, run:

```bash
# Every hour
npm run query:report

# Or set up a cron job / scheduled task
```

## 📊 Example Use Cases

### 1. Check Your Performance
```bash
npm run query:report
# Look for "★" markers to see your positions
# Check "YOUR POSITIONS SUMMARY" section
```

### 2. Find Top Competitors
```bash
npm run query:report
# Check "SUMMARY BY WALLET" section
# See who has most liquidity and rewards
```

### 3. Monitor Eligibility
```bash
npm run query:report
# Check "REWARDS ELIGIBILITY BREAKDOWN"
# See how many positions are earning rewards
```

### 4. Track Subscription Status
```bash
npm run query:report
# Check "SUBSCRIPTION STATUS" section
# Ensure your positions are subscribed
```

## 🎯 What Makes a Position Eligible?

For a position to earn rewards, it must be:

1. ✅ **Subscribed**: Wallet must have subscribed
2. ✅ **Passive**: No modifications within 43200 blocks (~24 hours)
3. ✅ **Above 0.01% threshold**: Position must be at least 1 basis point of pool liquidity

The report shows all of this for every position!

## 📝 Notes

- **★** = Your positions (highlighted)
- Percentages are calculated from current subgraph data
- Fees shown are cumulative (total since position creation)
- Rewards are from all epochs combined
- Report updates in real-time as subgraph syncs

## ✅ Summary

**YES**, your tool does all of this:

- ✅ **Live report** showing all positions
- ✅ **Percentage of rewards** (per position and per wallet)
- ✅ **Fees** (fee growth for token0 and token1)
- ✅ **Rewards eligibility** (based on classification)
- ✅ **Subscription status** (subscribed or not)

Run `npm run query:report` after deployment to see it in action! 🚀

