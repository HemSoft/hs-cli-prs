````skill
---
name: hs-cli-template
description: V1.0 - Tactical helper for working with the hs-cli-template repository - the canonical HemSoft CLI template
---

# hs-cli-template Tactical Guide

Tactical, step-by-step guide for working with the hs-cli-template repository specifically.

**Strategic Guidance**: See [AGENTS.md](../../../AGENTS.md) for philosophy and principles.

## Repository Context

**Location**: `D:\github\HemSoft\hs-cli-template`
**Purpose**: Production-ready CLI template for HemSoft CLI tools
**Stack**: TypeScript, Commander.js, GitHub Copilot SDK, Husky, ESLint, Prettier

## Quick Reference

### File Locations

```
Key Files:
├── src/index.ts                    # CLI entry point, command registration
├── src/commands/auth.ts            # Authentication commands
├── src/commands/config.ts          # Configuration commands
├── src/commands/hello.ts           # Demo command (replace in derived CLIs)
├── src/lib/ai.ts                   # AIService wrapper for Copilot SDK
├── src/lib/banner.ts               # Branding, ASCII logo, gradients
├── src/lib/config.ts               # Configuration storage with Conf
├── package.json                    # Dependencies, scripts, metadata
├── tsconfig.json                   # TypeScript configuration
├── eslint.config.js                # ESLint rules
├── .prettierrc                     # Prettier formatting rules
├── .husky/pre-commit               # Pre-commit hook script
└── AGENTS.md                       # Strategic guidance for AI agents
```

### Common Commands

```powershell
# Development
npm run dev <command>              # Run command in dev mode
npm run dev config show            # Show current config
npm run dev auth status            # Check auth status
npm run dev hello                  # Run demo command

# Building
npm run build                      # Compile TypeScript to dist/
npm start <command>                # Run built version

# Quality Checks
npm run lint                       # Lint TypeScript files
npm run lint:fix                   # Auto-fix linting issues
npm run format                     # Format all TypeScript files
npm run format:check               # Check formatting without changing
npm run type-check                 # TypeScript type checking
npm run check                      # Run all checks (lint + format + type)

# Git Workflow
git add .                          # Stage changes
git commit -m "message"            # Triggers pre-commit hooks automatically
git commit --no-verify             # Skip hooks (use sparingly)

# Setup/Maintenance
npm install                        # Install deps + setup Husky
npm run prepare                    # Setup Husky hooks manually
```

## Common Workflows

### Testing Changes Locally

```powershell
# 1. Navigate to repo
Set-Location "D:\github\HemSoft\hs-cli-template"

# 2. Make code changes

# 3. Run affected command
npm run dev <command>

# 4. Run quality checks
npm run check

# 5. Commit (triggers automatic quality gates)
git add .
git commit -m "Description of changes"
```

### Adding a New Command

**Step 1**: Create command file

```powershell
# Create new file
New-Item -Path "src/commands/my-command.ts" -ItemType File
```

**Step 2**: Implement command using standard pattern

```typescript
// src/commands/my-command.ts
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import logSymbols from 'log-symbols';
import { AIService } from '../lib/ai.js';

export interface MyCommandOptions {
  input?: string;
  model?: string;
}

export async function myCommand(options: MyCommandOptions) {
  const ai = new AIService(
    'Your custom system prompt here',
    options.model
  );
  const spinner = ora();

  try {
    // Validate inputs
    if (!options.input) {
      console.log(chalk.red(`${logSymbols.error} Input is required`));
      process.exit(1);
    }

    spinner.start('Processing...');

    // Use AI service
    const result = await ai.prompt(`Process: ${options.input}`);

    spinner.succeed('Complete!');

    // Display results
    console.log(
      boxen(chalk.cyan(result), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: 'Result',
        titleAlignment: 'center',
      })
    );
  } catch (error) {
    spinner.fail('Operation failed');
    console.error(
      chalk.red(logSymbols.error),
      error instanceof Error ? error.message : 'Unknown error'
    );
    process.exit(1);
  } finally {
    await ai.close();
  }
}
```

**Step 3**: Register in `src/index.ts`

```typescript
// Add import at top
import { myCommand } from './commands/my-command.js';

// Add command registration after existing commands
program
  .command('my-command')
  .description('Description of what this command does')
  .option('-i, --input <value>', 'Input description')
  .showHelpAfterError(true)
  .action((options) => myCommand({ ...options, model: globalModel }));
```

**Step 4**: Test

```powershell
npm run dev my-command -i "test value"
```

### Modifying Branding

**ASCII Logo** (`src/lib/banner.ts`):

1. Generate new ASCII art at https://patorjk.com/software/taag/
2. Update `LOGO_LINES` array:
   ```typescript
   const LOGO_LINES = [
     '  ╦ ╦╔═╗  ╔═╗╦  ╦',
     '  ╠═╣╚═╗  ║  ║  ║',
     '  ╩ ╩╚═╝  ╚═╝╩═╝╩',
   ];
   ```

**Gradient Theme** (`src/lib/banner.ts`):

```typescript
// Choose from: vice (pink/yellow), gold, greenGlow
const myGradient = gradient([
  { color: '#42d392', pos: 0 },
  { color: '#647eff', pos: 0.5 },
  { color: '#42d392', pos: 1 },
]);
```

**Tagline** (`src/lib/banner.ts`):

```typescript
export function showBanner() {
  // ... existing code ...
  console.log(chalk.white('    Your custom tagline here\n'));
  console.log(chalk.gray('    ✦ by HemSoft Developments ✦\n'));
}
```

### Updating Configuration Schema

**Add new config field** (`src/lib/config.ts`):

```typescript
// 1. Update interface
export interface CLIConfig {
  defaultModel: string;
  availableModels: string[];
  firstRunComplete: boolean;
  myNewField: string;  // Add your field
}

// 2. Add to schema
const schema = {
  defaultModel: { type: 'string' as const, default: 'claude-sonnet-4.5' },
  availableModels: { type: 'array' as const, default: [] as string[] },
  firstRunComplete: { type: 'boolean' as const, default: false },
  myNewField: { type: 'string' as const, default: 'default-value' },
};

// 3. Add getter/setter functions
export function getMyNewField(): string {
  return config.get('myNewField');
}

export function setMyNewField(value: string): void {
  config.set('myNewField', value);
}
```

### Fixing GitHub Authentication Issues

**Check current status**:
```powershell
gh auth status
```

**Switch to correct account**:
```powershell
# Switch to HemSoft for this repo
gh auth switch -u HemSoft
```

**Login new account**:
```powershell
gh auth login
```

**Verify from CLI**:
```powershell
npm run dev auth status
```

## Code Patterns

### Standard Command Structure

Always follow this pattern for consistency:

```typescript
export async function commandName(options: Options) {
  const ai = new AIService(systemPrompt, options.model);
  const spinner = ora();

  try {
    // 1. Validate inputs early
    if (!options.required) {
      console.log(chalk.red(`${logSymbols.error} Missing required option`));
      process.exit(1);
    }

    // 2. Start spinner for long operations
    spinner.start('Processing...');

    // 3. Perform operations
    const result = await ai.prompt(prompt);

    // 4. Success feedback
    spinner.succeed('Operation complete!');

    // 5. Display results
    console.log(boxen(result, { ... }));

  } catch (error) {
    // 6. Handle errors
    spinner.fail('Operation failed');
    console.error(chalk.red(logSymbols.error), error.message);
    process.exit(1);
  } finally {
    // 7. ALWAYS clean up resources
    await ai.close();
  }
}
```

### Import Statement Pattern

```typescript
// External dependencies - no extension
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import logSymbols from 'log-symbols';
import { Command } from 'commander';

// Local imports - MUST use .js extension (TypeScript module requirement)
import { AIService } from '../lib/ai.js';
import { config, getEffectiveModel } from '../lib/config.js';
import { showBanner } from '../lib/banner.js';
```

### Styled Output Patterns

```typescript
// Success
console.log(chalk.green(`${logSymbols.success} Operation successful`));

// Info
console.log(chalk.cyan(`${logSymbols.info} Information message`));

// Warning
console.log(chalk.yellow(`${logSymbols.warning} Warning message`));

// Error
console.log(chalk.red(`${logSymbols.error} Error message`));

// Important content box
console.log(
  boxen(content, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    title: 'Title',
    titleAlignment: 'center',
  })
);

// Gradient text
import gradient from 'gradient-string';
const myGradient = gradient(['#ff0000', '#00ff00']);
console.log(myGradient('Colorful text'));
```

### AIService Usage Pattern

```typescript
// Initialize with custom system message
const ai = new AIService(
  `You are a helpful assistant that provides {domain} expertise.
Always be concise and actionable.`,
  options.model  // Respects user's model choice
);

try {
  // Single prompt
  const response = await ai.prompt('Your question here');

  // Multi-turn conversation
  const response1 = await ai.prompt('First question');
  const response2 = await ai.prompt(`Follow-up: ${response1}`);
  
} finally {
  // CRITICAL: Always close to free resources
  await ai.close();
}
```

## Troubleshooting

### Pre-commit Hooks Not Running

**Symptoms**: Commits succeed even with linting errors

**Fixes**:
```powershell
# Reinstall Husky
npm run prepare

# Check if hook exists
Get-Content .husky/pre-commit

# Manual trigger
npm run check
```

### TypeScript Errors

**Common Issues**:

1. **Missing .js extension**:
   ```typescript
   // ❌ Wrong
   import { config } from '../lib/config';
   
   // ✅ Correct
   import { config } from '../lib/config.js';
   ```

2. **Strict mode violations**:
   ```typescript
   // ❌ Wrong - implicit any
   function process(data) { }
   
   // ✅ Correct - explicit type
   function process(data: string): void { }
   ```

3. **Unhandled null/undefined**:
   ```typescript
   // ❌ Wrong
   const value = config.get('optional');
   console.log(value.toString());
   
   // ✅ Correct
   const value = config.get('optional');
   if (value) {
     console.log(value.toString());
   }
   ```

### Build Succeeds But Runtime Fails

**Check**:
```powershell
# Verify imports use .js extension
Select-String -Path "src/**/*.ts" -Pattern "from '.*(?<!\.js)'" -SimpleMatch

# Verify package.json has type: module
Get-Content package.json | Select-String "type.*module"

# Check Node version
node --version  # Should be >= 18.0.0

# Rebuild
Remove-Item -Recurse -Force dist
npm run build
```

### AIService/Auth Issues

**Check GitHub CLI auth**:
```powershell
# Status
gh auth status

# Login
gh auth login

# Switch account
gh auth switch -u HemSoft
```

**Test from CLI**:
```powershell
# Check auth status
npm run dev auth status

# Verify Copilot access
npm run dev config show
```

**Common error**: "franzhemmer cannot create a repository for HemSoft"
**Fix**: Switch active account to HemSoft: `gh auth switch -u HemSoft`

## Quality Checklist

Before committing changes to this template:

- [ ] `npm run check` passes (lint + format + type-check)
- [ ] All commands tested with `npm run dev <command>`
- [ ] New features documented in README.md
- [ ] Code follows established patterns
- [ ] Resources cleaned up properly (AIService.close, etc.)
- [ ] Error messages are helpful and actionable
- [ ] Cross-platform considerations addressed
- [ ] No secrets or credentials in code

## File-Specific Notes

### src/index.ts
- **Don't**: Add business logic here
- **Do**: Only wire commands together, set up Commander.js
- **Pattern**: Keep it declarative - command registration only

### src/commands/*.ts
- **Don't**: Directly import Copilot SDK
- **Do**: Use AIService abstraction
- **Pattern**: Follow standard command structure (try/catch/finally)

### src/lib/ai.ts
- **Critical**: Always close sessions in finally blocks
- **Pattern**: Wrapper around Copilot SDK, not a CLI command
- **Responsibility**: Manage SDK lifecycle only

### src/lib/config.ts
- **Storage**: Uses Conf package - JSON stored in user's app data
- **Pattern**: Export typed getters/setters for each config field
- **Don't**: Store sensitive data (tokens, passwords, API keys)

### src/lib/banner.ts
- **Purpose**: Branding and visual identity
- **Customization**: This file should be heavily modified by CLI authors
- **Pattern**: Gradient styling, ASCII art, HemSoft branding line

## Integration Points

### GitHub Copilot SDK
- **Dependency**: `@github/copilot-sdk`
- **Auth**: Relies on GitHub CLI (`gh`)
- **Lifecycle**: Start → Prompt → Close (always in finally)

### Commander.js
- **Pattern**: Declarative command registration
- **Styling**: Custom help formatter in `src/index.ts`
- **Options**: Global options (--model) + command options

### Conf (Configuration)
- **Storage**: Platform-specific app data directory
- **Format**: JSON
- **Access**: Type-safe getters/setters

### Husky + lint-staged
- **Trigger**: Pre-commit hook
- **Actions**: ESLint fix + Prettier format on staged files
- **Setup**: Automatic on `npm install`

## Quick Fixes

### "Module not found" error
```powershell
# Verify .js extension in imports
npm run type-check
```

### "Command not found" when using built CLI
```powershell
# Rebuild
npm run build

# Check bin field in package.json
Get-Content package.json | Select-String "bin"
```

### "Permission denied" on scripts
```powershell
# Windows - shouldn't happen
# macOS/Linux - make executable
chmod +x dist/index.js
```

### Pre-commit hook fails but you need to commit urgently
```powershell
# Fix issues first (preferred)
npm run lint:fix
npm run format

# OR skip hooks (not recommended)
git commit --no-verify -m "message"
```

## When to Update This Skill

Update this tactical guide when:
- New commands are added to the template
- File structure changes
- New patterns are established
- Common troubleshooting issues are discovered
- Dependencies are significantly updated

**Keep in sync with**: README.md and AGENTS.md

````
