# prs

> 🔍 Tool to check PR assignments and do agentic analysis on PRs across GitHub and Bitbucket

A professional CLI tool for monitoring pull requests across multiple platforms with beautiful terminal output, token-based authentication, and multi-account support.

## ✨ Features

- 🔍 **Multi-platform**: Check PRs from GitHub and Bitbucket simultaneously
- 🔐 **Token-Based Auth**: Secure authentication using Personal Access Tokens and App Passwords
- 👥 **Multi-Account**: Support for multiple GitHub accounts and Bitbucket workspaces
- ⚙️ **Flexible Configuration**: Environment variables and config files
- 🔄 **Watch Mode**: Continuous monitoring with configurable refresh intervals
- 📊 **Filtered Views**: Show approved PRs, merged PRs, or all PRs you're involved with
- 🎯 **Smart API Integration**: GitHub via Octokit, Bitbucket via REST API
- 🎨 **Beautiful Output**: Styled terminal tables with clickable links

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **GitHub Personal Access Token(s)** with `repo` and `read:org` scopes
- **Bitbucket App Password(s)** (optional, for Bitbucket support)
- **GitHub Copilot** (optional, for AI-powered features)

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

#### 1. Create Access Tokens

**GitHub Personal Access Token:**
1. Visit https://github.com/settings/tokens/new
2. Select scopes: `repo` (Full control of private repositories) and `read:org` (Read org and team membership)
3. Copy the generated token (starts with `ghp_`)

**Bitbucket App Password** (optional):
1. Visit https://bitbucket.org/account/settings/app-passwords/
2. Select permissions: `Pull requests: Read` and `Account: Read`
3. Copy the generated password

#### 2. Run the Tool

The first time you run `prs`, it will automatically detect that no configuration exists and offer to guide you through setup:

```bash
npm run dev
```

You'll see:
```
👋 Welcome to prs!

It looks like this is your first time running prs.
Let's get you set up with GitHub and/or Bitbucket accounts.

? Would you like to configure prs now? (Y/n)
```

**If you choose "Yes":**
- The interactive setup wizard will launch
- You'll be prompted for GitHub accounts (username, org, environment variable name)
- Optionally configure Bitbucket workspaces
- Tokens will be validated if available in environment
- Configuration saved to `~/hemsoft/prs/config.json`

**If you choose "No":**
- A minimal starter configuration will be created with empty accounts
- You can add accounts later by running `prs init`
- The app will run normally (showing "All clear! No PRs found." until accounts are configured)

Alternatively, you can run the setup wizard directly:
```bash
npm run dev init
```

#### 3. Set Environment Variables

**Bash/Zsh** (`~/.bashrc` or `~/.zshrc`):
```bash
export GITHUB_TOKEN_USERNAME="ghp_your_token_here"
export BITBUCKET_TOKEN_WORKSPACE="your_app_password_here"
```

**PowerShell** (`$PROFILE`):
```powershell
$env:GITHUB_TOKEN_USERNAME="ghp_your_token_here"
$env:BITBUCKET_TOKEN_WORKSPACE="your_app_password_here"
```

**Fish** (`~/.config/fish/config.fish`):
```fish
set -gx GITHUB_TOKEN_USERNAME "ghp_your_token_here"
set -gx BITBUCKET_TOKEN_WORKSPACE "your_app_password_here"
```

> 💡 **Tip**: Environment variable names are configurable during setup. Use descriptive names to manage multiple accounts.

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

# Check authentication status for all configured accounts
prs auth status

# View authentication help
prs auth help

# Re-run setup wizard
prs init
```

### Configuration

Configuration is loaded from:

1. **User config file** (`~/hemsoft/prs/config.json`) - Created by `prs init`
2. **Environment variables** - For tokens (required) and overrides

#### Environment Variables

Environment variable names are user-defined during setup. Common patterns:

```bash
# GitHub (names are configurable)
export GITHUB_TOKEN_PERSONAL="ghp_xxx"
export GITHUB_TOKEN_WORK="ghp_xxx"

# Bitbucket (names are configurable)
export BITBUCKET_TOKEN_MYWORKSPACE="app_password_here"
export BITBUCKET_TOKEN_COMPANY="app_password_here"

# Behavior overrides
export SKIP_BITBUCKET=true
export WATCH_INTERVAL=30
```

#### Config File Example

```json
{
  "github": {
    "accounts": [
      {
        "username": "myusername",
        "org": "my-org",
        "tokenEnvVar": "GITHUB_TOKEN_PERSONAL"
      },
      {
        "username": "workusername",
        "org": "work-org",
        "tokenEnvVar": "GITHUB_TOKEN_WORK"
      }
    ]
  },
  "bitbucket": {
    "workspaces": [
      {
        "workspace": "myworkspace",
        "username": "myusername",
        "userDisplayName": "My Name",
        "tokenEnvVar": "BITBUCKET_TOKEN_MYWORKSPACE"
      }
    ]
  },
  "skipBitbucket": false,
  "watchInterval": 15
}
```

> 📝 **Note**: Tokens are **never** stored in the config file. Only environment variable names are saved.

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
│   ├── github.ts        # GitHub API via Octokit
│   └── bitbucket.ts     # Bitbucket REST API
├── commands/             # Command implementations
│   ├── auth.ts          # Authentication status and help
│   └── hello.ts         # Demo AI command
├── lib/                  # Core services
│   ├── ai.ts            # AI service (GitHub Copilot SDK)
│   ├── banner.ts        # HemSoft branding
│   └── config-loader.ts # Configuration loading
├── types/                # TypeScript type definitions
│   ├── config.ts        # Configuration schemas (Zod)
│   ├── github.ts        # GitHub API types
│   └── bitbucket.ts     # Bitbucket API types
└── utils/                # Utility functions
    ├── token-validator.ts # Token validation and scope checking
    ├── interactive-setup.ts # Setup wizard
    └── splash-texts.ts  # Loading messages
```

## 🔧 Troubleshooting

### Token Authentication Issues

If you see errors about missing PRs or authentication:

1. **Check authentication status for all accounts:**
   ```bash
   prs auth status
   ```

2. **Verify tokens are set in environment:**
   ```bash
   # On Windows (PowerShell)
   $env:GITHUB_TOKEN_USERNAME

   # On macOS/Linux (Bash/Zsh)
   echo $GITHUB_TOKEN_USERNAME
   ```

3. **Common issues:**
   - **"Token not set"**: Environment variable not defined or misspelled
   - **"Invalid"**: Token expired, revoked, or incorrect
   - **"Insufficient scopes"**: Token missing required permissions (`repo`, `read:org` for GitHub)
   - **"Rate limited"**: Too many API requests - wait and retry

4. **Validate token manually:**
   ```bash
   # GitHub
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user
   
   # Bitbucket
   curl -u username:app_password https://api.bitbucket.org/2.0/user
   ```

5. **Regenerate tokens:**
   - GitHub: https://github.com/settings/tokens
   - Bitbucket: https://bitbucket.org/account/settings/app-passwords/

### Configuration Issues

- **First-time users**: The app automatically offers to run setup wizard - just say "Yes"!
- **Old configuration format**: The app will automatically detect and migrate old configs on first run
- **Missing PRs**: Ensure your username/org are correct in config
- **Wrong account**: Check `tokenEnvVar` matches your environment variable names
- **Missing tokens**: Run `prs auth status` to see which tokens are missing

### Copilot SDK Issues

For AI-powered features (optional):
- Install Copilot CLI: `npm install -g @github/copilot-cli`
- Authenticate: `copilot auth login`
- Check status: `prs auth status` (shows Copilot status)

## 🎯 Architecture

### Template-Based Design

Built on the HemSoft CLI Template (`hs-cli-template`):
- Modern tooling (TypeScript, ESLint, Prettier)
- Pre-commit hooks for quality
- AI integration ready via GitHub Copilot SDK
- Professional terminal UI with HemSoft branding

### GitHub Integration

Uses Octokit (GitHub REST API) for authentication and data fetching:
- Token-based authentication (Personal Access Tokens)
- Multi-account support via multiple Octokit instances
- GraphQL API for efficient PR queries
- Rate limit monitoring and handling
- Required scopes: `repo`, `read:org`

### Bitbucket Integration

Direct REST API integration:
- App Password authentication (Basic Auth)
- Multi-workspace support
- Fetches repositories updated in last 90 days
- OAuth scopes: `pullrequest:read`, `account:read`

### Security Principles

- **No token storage**: Tokens stored only in environment variables
- **No plaintext commits**: Config files never contain sensitive data
- **Scope validation**: Tokens validated on setup for required permissions
- **Rate limit respect**: Automatic retry with exponential backoff

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
- [@octokit/rest](https://github.com/octokit/rest.js) - GitHub REST API client
- [@octokit/graphql](https://github.com/octokit/graphql.js) - GitHub GraphQL API client
- [GitHub Copilot CLI SDK](https://github.com/github/copilot-cli-sdk) - AI-powered features
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [cli-table3](https://github.com/cli-table/cli-table3) - Beautiful tables
- [Consola](https://github.com/unjs/consola) - Console logging
- [Zod](https://github.com/colinhacks/zod) - Schema validation
- [Terminal Link](https://github.com/sindresorhus/terminal-link) - Clickable links
- [Inquirer](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts

---

**Built with ❤️ by HemSoft Developments**
