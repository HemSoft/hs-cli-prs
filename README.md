# prs

> 🔍 Tool to check PR assignments and do agentic analysis on PRs across GitHub and Bitbucket

A professional CLI tool for monitoring pull requests across multiple platforms with beautiful terminal output and flexible configuration.

## ✨ Features

- 🔍 **Multi-platform**: Check PRs from GitHub and Bitbucket simultaneously
- ⚙️ **Flexible Configuration**: Environment variables, config files, or CLI options
- 🔄 **Watch Mode**: Continuous monitoring with configurable refresh intervals
- 📊 **Filtered Views**: Show approved PRs, merged PRs, or all PRs you're involved with
- 🎯 **Smart Detection**: Uses gh CLI for GitHub and REST API for Bitbucket
- 🎨 **Beautiful Output**: Styled terminal tables with clickable links
- 👥 **Multi-Account**: Support for multiple GitHub accounts and organizations

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **GitHub CLI** (`gh`) - [Install here](https://cli.github.com/)
- **Bitbucket App Password** (optional, for Bitbucket support)

### Installation

```bash
# Clone the repository
git clone https://github.com/HemSoft/hs-cli-prs.git
cd hs-cli-prs

# Install dependencies
npm install

# Build the tool
npm run build
```

### First-Time Setup

Run the interactive setup wizard:

```bash
npm run dev init
```

This will:
1. Detect your authenticated GitHub accounts
2. Let you select which accounts/orgs to monitor
3. Optionally configure Bitbucket access
4. Save configuration to `~/hemsoft/prs/config.json`

## 📖 Usage

### Basic Commands

```bash
# Run in watch mode (refreshes every 15 minutes)
prs

# Run once and exit
prs --once

# List PRs you've approved that are still open
prs --approved-open

# List PRs you've approved that were merged since a date
prs --approved-merged-since 2025-01-01

# Custom watch interval (in minutes)
prs --watch 30

# Skip Bitbucket checks (GitHub only)
prs --skip-bitbucket

# Enable debug output
prs --debug

# Check authentication status
prs auth-check

# Check access to a specific organization
prs auth-check --org my-organization
```

### Configuration

Configuration is loaded from multiple sources (highest priority first):

1. **Environment variables**
2. **Local config file** (`./.prs.json`)
3. **User config file** (`~/hemsoft/prs/config.json`)
4. **Legacy location** (`~/.prs.json`)
5. **Defaults**

#### Environment Variables

```bash
# GitHub
GITHUB_ORG=your-org
GITHUB_TOKEN=ghp_xxx           # Optional, uses gh CLI auth by default
GH_TOKEN=ghp_xxx               # Alternative to GITHUB_TOKEN

# Bitbucket
BITBUCKET_WORKSPACE=your-workspace
BITBUCKET_USERNAME=your-username
BITBUCKET_API_KEY=your-api-key
BITBUCKET_USER_DISPLAY_NAME="Your Name"

# Behavior
SKIP_BITBUCKET=false
WATCH_INTERVAL=15
```

#### Config File Example

```json
{
  "github": {
    "org": "your-org",
    "accounts": [
      { "account": "account1", "org": "org1" },
      { "account": "account2", "org": "org2" }
    ]
  },
  "bitbucket": {
    "workspace": "your-workspace",
    "userDisplayName": "Your Name"
  },
  "skipBitbucket": false,
  "watchInterval": 15
}
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Lint and format
npm run lint
npm run format

# Type check
npm run type-check

# Run all checks
npm run check
```

## 📁 Project Structure

```
src/
├── index.ts              # Main CLI entry point
├── api/                  # API clients
│   ├── github.ts        # GitHub API via gh CLI
│   └── bitbucket.ts     # Bitbucket REST API
├── lib/                  # Core services
│   ├── ai.ts            # AI service (for future PR analysis)
│   ├── banner.ts        # HemSoft branding
│   ├── config.ts        # Legacy config support
│   └── config-loader.ts # Configuration loading
├── types/                # TypeScript type definitions
│   ├── config.ts        # Configuration schemas
│   ├── github.ts        # GitHub API types
│   └── bitbucket.ts     # Bitbucket API types
└── utils/                # Utility functions
    ├── auth-check.ts    # GitHub auth verification
    ├── interactive-setup.ts # Setup wizard
    └── splash-texts.ts  # Loading messages
```

## 🔧 Troubleshooting

### GitHub Authentication Issues

If you see errors about missing PRs or authentication:

1. **Check your authentication status:**
   ```bash
   prs auth-check
   # or
   gh auth status
   ```

2. **Authenticate with GitHub CLI:**
   ```bash
   gh auth login
   ```

3. **Refresh expired tokens:**
   ```bash
   gh auth refresh
   ```

4. **Switch accounts if needed:**
   ```bash
   gh auth switch
   ```

5. **Verify organization access:**
   ```bash
   prs auth-check --org your-org
   ```

## 🎯 Architecture

### Template-Based Design

Built on the HemSoft CLI Template (`hs-cli-template`):
- Modern tooling (TypeScript, ESLint, Prettier)
- Pre-commit hooks for quality
- AI integration ready for future features
- Professional terminal UI

### GitHub Integration

Uses GitHub CLI (`gh`) for authentication and API access:
- Leverages existing `gh auth` credentials
- Supports multi-account workflows
- No need for personal access tokens
- Works with SSO-enabled organizations

### Bitbucket Integration

Direct REST API integration:
- Requires App Password for authentication
- Fetches repositories updated in last 90 days
- Supports workspace-based access

## ✅ Quality Gates

- **Linting**: ESLint strict mode
- **Formatting**: Prettier auto-formatting
- **Type Safety**: TypeScript strict mode
- **Pre-commit**: Auto-lint and format on commit

## 🚀 Future Features

- AI-powered PR analysis using GitHub Copilot SDK
- PR summarization and insights
- Code review automation
- Bitbucket Cloud/Server support
- GitLab support
- Custom PR filters and sorting

## 📄 License

MIT © HemSoft Developments

## 🔗 Credits

Built with:
- [GitHub Copilot CLI SDK](https://github.com/github/copilot-cli-sdk)
- [Commander.js](https://github.com/tj/commander.js)
- [Chalk](https://github.com/chalk/chalk)
- [cli-table3](https://github.com/cli-table/cli-table3)
- [Consola](https://github.com/unjs/consola)
- [Zod](https://github.com/colinhacks/zod)
- [Terminal Link](https://github.com/sindresorhus/terminal-link)

---

**Built with ❤️ by HemSoft Developments**
