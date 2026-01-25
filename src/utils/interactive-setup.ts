import { exec } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { consola } from 'consola';
import inquirer from 'inquirer';
import type { Config } from '../types/config.js';

const execAsync = promisify(exec);

/**
 * Check if GitHub CLI is installed
 */
export async function checkGitHubCLI(): Promise<boolean> {
  try {
    await execAsync('gh --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get authenticated GitHub accounts from gh CLI
 */
export async function getGitHubAccounts(): Promise<string[]> {
  try {
    const { stdout, stderr } = await execAsync('gh auth status');
    // gh auth status outputs to stdout on success, stderr on failure
    // Check both to handle different versions/platforms
    const output = stdout || stderr;

    const accounts: string[] = [];
    // Match "Logged in to github.com account USERNAME" - the checkmark may vary by platform
    const regex = /Logged in to github\.com account (\S+)/gi;
    let match: RegExpExecArray | null = null;

    match = regex.exec(output);
    while (match !== null) {
      if (match[1]) {
        // Strip trailing (keyring) or similar parenthetical info
        const account = match[1].replace(/\([^)]*\)$/, '');
        accounts.push(account);
      }
      match = regex.exec(output);
    }

    return accounts;
  } catch {
    return [];
  }
}

/**
 * Interactive setup wizard
 */
export async function runInteractiveSetup(): Promise<Config> {
  console.log('');
  consola.box('🚀 Welcome to PRS Setup!');
  console.log('');

  // Step 1: Check GitHub CLI
  consola.start('Checking for GitHub CLI...');
  const hasGH = await checkGitHubCLI();

  if (!hasGH) {
    consola.error('❌ GitHub CLI not found!');
    console.log('');
    consola.info('Please install GitHub CLI first:');
    consola.info('  Windows:  winget install --id GitHub.cli');
    consola.info('  macOS:    brew install gh');
    consola.info('  Linux:    https://github.com/cli/cli#installation');
    console.log('');
    consola.info('After installing, run: gh auth login');
    process.exit(1);
  }

  consola.success('✅ GitHub CLI found!');
  console.log('');

  // Step 2: Detect GitHub accounts
  consola.start('Detecting authenticated GitHub accounts...');
  const accounts = await getGitHubAccounts();

  if (accounts.length === 0) {
    consola.error('❌ No authenticated GitHub accounts found!');
    console.log('');
    consola.info('Please authenticate with GitHub first:');
    consola.info('  gh auth login');
    process.exit(1);
  }

  consola.success(`✅ Found ${accounts.length} account(s): ${accounts.join(', ')}`);
  console.log('');

  // Step 3: Select accounts to use
  const selectedAccounts: Array<{ account: string; org: string }> = [];

  if (accounts.length === 1) {
    consola.info(`Using account: ${accounts[0]}`);
    const { org } = await inquirer.prompt<{ org: string }>([
      {
        type: 'input',
        name: 'org',
        message: 'What organization should we check PRs for?',
        default: accounts[0] || 'your-org',
      },
    ]);
    selectedAccounts.push({ account: accounts[0] as string, org });
  } else {
    consola.info('Multiple GitHub accounts detected!');
    const { useAll } = await inquirer.prompt<{ useAll: boolean }>([
      {
        type: 'confirm',
        name: 'useAll',
        message: 'Would you like to use all accounts?',
        default: true,
      },
    ]);

    if (useAll) {
      for (const account of accounts) {
        const { org } = await inquirer.prompt<{ org: string }>([
          {
            type: 'input',
            name: 'org',
            message: `Organization for ${account}?`,
            default: account || 'your-org',
          },
        ]);
        selectedAccounts.push({ account, org });
      }
    } else {
      // Manual selection
      for (const account of accounts) {
        const { use } = await inquirer.prompt<{ use: boolean }>([
          {
            type: 'confirm',
            name: 'use',
            message: `Include account: ${account}?`,
            default: true,
          },
        ]);
        if (use) {
          const { org } = await inquirer.prompt<{ org: string }>([
            {
              type: 'input',
              name: 'org',
              message: `  Organization for ${account}?`,
              default: account || 'your-org',
            },
          ]);
          selectedAccounts.push({ account, org });
        }
      }
    }
  }

  console.log('');

  // Step 4: Bitbucket configuration
  const { useBitbucket } = await inquirer.prompt<{ useBitbucket: boolean }>([
    {
      type: 'confirm',
      name: 'useBitbucket',
      message: 'Do you use Bitbucket?',
      default: false,
    },
  ]);
  console.log('');

  let bitbucketConfig:
    | {
        workspace: string;
        username?: string | undefined;
        apiKey?: string | undefined;
        userDisplayName: string;
      }
    | undefined;

  if (useBitbucket) {
    consola.info('Configuring Bitbucket...');
    const answers = await inquirer.prompt<{
      workspace: string;
      username: string;
      apiKey: string;
      displayName: string;
    }>([
      {
        type: 'input',
        name: 'workspace',
        message: 'Bitbucket workspace slug:',
        default: '',
      },
      {
        type: 'input',
        name: 'username',
        message: 'Bitbucket username (optional):',
        default: '',
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Bitbucket App Password (optional):',
        default: '',
      },
      {
        type: 'input',
        name: 'displayName',
        message: 'Your display name:',
        default: 'Your Name',
      },
    ]);

    bitbucketConfig = {
      workspace: answers.workspace,
      username: answers.username || undefined,
      apiKey: answers.apiKey || undefined,
      userDisplayName: answers.displayName,
    };
    console.log('');
  }

  // Step 5: Create config
  const config: Config = {
    github: {
      org: selectedAccounts[0]?.org || 'your-org',
      accounts: selectedAccounts,
    },
    bitbucket: bitbucketConfig || {
      workspace: 'your-workspace',
      userDisplayName: 'Your Name',
    },
    skipBitbucket: !useBitbucket,
    watchInterval: 15,
  };

  // Step 6: Save config
  const configDir = join(homedir(), 'hemsoft', 'prs');
  const configPath = join(configDir, 'config.json');

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  consola.success(`✅ Configuration saved to: ${configPath}`);
  console.log('');

  return config;
}
