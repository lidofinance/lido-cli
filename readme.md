# CLI tool for Lido protocol

## Requirements

- [Yarn](https://yarnpkg.com/) package manager
- [Node.js](https://nodejs.org/) (version 14 or higher)
- [Git](https://git-scm.com/)

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/lidofinance/lido-cli.git
cd lido-cli
```

### 2. Install Dependencies
```bash
yarn install
```

### 3. Configure Environment
Create a copy of the sample environment file and configure your settings:

```bash
cp sample.env .env
```

Open `.env` in your preferred text editor and fill in the required values.

### 4. Setup PowerShell Module (Windows Only)
If you're using Windows, set up the PowerShell module:

```powershell
# First time setup - import the module
Import-Module .\lido-cli.psm1
```
You can also create a permanent PowerShell profile to automatically import the module:
```powershell
# Add this line to your PowerShell profile ($PROFILE)
Import-Module "C:\full\path\to\lido-cli.psm1"
```

## Run

### Linux/MacOS
```bash
# Show available commands
./run.sh help

# Execute a specific command
./run.sh <command> [options]
```

### Windows
```powershell
# Show available commands
Invoke-LidoCli help

# Execute a specific command
Invoke-LidoCli <command> [options]
```