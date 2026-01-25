# Dev Container Configuration

This directory contains the development container configuration for the HemSoft CLI Template.

## What's Included

- **Node.js 22**: Latest LTS version with TypeScript support
- **GitHub CLI**: Pre-installed for Copilot authentication
- **Zsh with Oh My Zsh**: Enhanced shell experience
- **VS Code Extensions**:
  - ESLint
  - Prettier
  - GitHub Copilot & Copilot Chat
  - Code Spell Checker
  - TypeScript Next

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) or [Docker Engine](https://docs.docker.com/engine/install/)
- [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Opening in a Container

1. Open VS Code in this repository
2. Press `F1` and select **Dev Containers: Reopen in Container**
3. Wait for the container to build and dependencies to install
4. Start developing!

Alternatively, you can use the **Reopen in Container** button when VS Code detects the devcontainer configuration.

### GitHub Copilot Workspace

This devcontainer is optimized for GitHub Copilot Workspace and will work seamlessly in cloud-based development environments.

## Post-Create Setup

The container automatically runs:
```bash
npm install && npm run prepare
```

This installs all dependencies and sets up Husky pre-commit hooks.

## Available Commands

Once inside the container, you can use all npm scripts:

```bash
npm run dev        # Run CLI in development mode
npm run build      # Build for production
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
npm run check      # Run all quality checks
```

## Authentication

To use GitHub Copilot features, authenticate with:

```bash
gh auth login
```

Then verify Copilot access:

```bash
gh auth status
```

## Customization

You can customize the devcontainer by editing `.devcontainer/devcontainer.json`. See the [devcontainer.json reference](https://containers.dev/implementors/json_reference/) for all available options.

## Troubleshooting

### Container Won't Build

- Ensure Docker Desktop is running
- Try rebuilding the container: `F1` → **Dev Containers: Rebuild Container**

### Extensions Not Working

- Ensure they're listed in `devcontainer.json` under `customizations.vscode.extensions`
- Rebuild the container to reinstall extensions

### Husky Hooks Not Running

- Run `npm run prepare` manually inside the container
- Check that `.husky/` directory has executable permissions

## Performance Tips

- **Windows Users**: For best performance, clone the repository into WSL 2 filesystem (e.g., `\\wsl$\Ubuntu\home\<user>\projects\`)
- **macOS Users**: Use Docker Desktop's file sharing optimizations in Settings → Resources → File Sharing
