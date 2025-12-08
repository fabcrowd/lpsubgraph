# Install Git on Windows

## Quick Install (Recommended)

### Option 1: Download Git for Windows

1. **Go to**: https://git-scm.com/download/win
2. **Download** the installer (it will auto-detect 64-bit or 32-bit)
3. **Run the installer**:
   - Click "Next" through the setup
   - **Important**: On "Select Components" page, make sure "Git from the command line and also from 3rd-party software" is checked
   - Keep clicking "Next" with default options
   - Click "Install"
4. **Restart PowerShell** after installation

### Option 2: Using Winget (Windows Package Manager)

If you have winget installed:

```powershell
winget install --id Git.Git -e --source winget
```

### Option 3: Using Chocolatey (if you have it)

```powershell
choco install git
```

## Verify Installation

After installing, restart PowerShell and run:

```powershell
git --version
```

Should show something like: `git version 2.42.0`

## ⚠️ IMPORTANT: You Don't Need Git for Deployment!

**You already have your subgraph code!** You don't need to run `graph init`.

Just:
1. Create the subgraph in Graph Studio (fill form, click Save)
2. Run `npm run deploy` from PowerShell
3. Enter version `v0.0.1`

That's it! No Git needed for deployment.

