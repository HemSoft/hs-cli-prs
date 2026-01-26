import { consola } from 'consola';
import inquirer from 'inquirer';
import chalk from 'chalk';
import type { Config } from '../types/config.js';
import { validateGitHubToken, validateBitbucketToken } from './token-validator.js';
import { saveConfig, getConfigPath } from '../lib/config-loader.js';

/**
 * Interactive setup wizard
 */
export async function runInteractiveSetup(): Promise<Config> {
  consola.box('🚀 Welcome to PRS Setup!');

  consola.info('This wizard will help you configure GitHub and Bitbucket access.');
  consola.info("You'll need to create Personal Access Tokens (PATs) for authentication.");

  // GitHub Setup
  const githubAccounts: Array<{ username: string; org: string; tokenEnvVar: string }> = [];
  consola.box('GitHub Configuration');
  consola.info('GitHub requires a Personal Access Token with these scopes:');
  consola.info('  - repo (Full control of private repositories)');
  consola.info('  - read:org (Read org and team membership)');
  consola.info('Create one at: https://github.com/settings/tokens/new');

  let addMoreGitHub = true;

  while (addMoreGitHub) {
    const { username, org, tokenEnvVar, validateNow } = await inquirer.prompt<{
      username: string;
      org: string;
      tokenEnvVar: string;
      validateNow: boolean;
      // @ts-expect-error - TypeScript cannot infer inquirer's complex overload types, but code is correct
    }>([
      {
        type: 'input',
        name: 'username',
        message: 'GitHub username:',
        validate: (input: string) => input.trim().length > 0 || 'Username is required',
      },
      {
        type: 'input',
        name: 'org',
        message: 'Organization to monitor:',
        validate: (input: string) => input.trim().length > 0 || 'Organization is required',
      },
      {
        type: 'input',
        name: 'tokenEnvVar',
        message: 'Environment variable name for token:',
        default: (answers: { username: string }) =>
          `GITHUB_TOKEN_${answers.username.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
        validate: (input: string) =>
          /^[A-Z][A-Z0-9_]*$/.test(input) ||
          'Must be uppercase letters, numbers, and underscores only',
      },
      {
        type: 'confirm',
        name: 'validateNow',
        message: 'Validate token now? (token must be in environment)',
        default: false,
      },
    ]);

    // Validate token if requested
    if (validateNow) {
      const token = process.env[tokenEnvVar];
      if (!token) {
        consola.warn(`⚠️  Environment variable ${tokenEnvVar} not found. Skipping validation.`);
      } else {
        consola.start('Validating GitHub token...');
        try {
          const validation = await validateGitHubToken(token);
          if (validation.valid) {
            consola.success(`✅ Token valid! Authenticated as: ${validation.username}`);
          } else {
            consola.error(`❌ Token validation failed: ${validation.error}`);
            const { continueAnyway } = await inquirer.prompt<{ continueAnyway: boolean }>([
              {
                type: 'confirm',
                name: 'continueAnyway',
                message: 'Continue anyway?',
                default: false,
              },
            ]);
            if (!continueAnyway) {
              continue;
            }
          }
        } catch (error) {
          consola.error('❌ Validation error:', error);
        }
      }
    }

    githubAccounts.push({ username, org, tokenEnvVar });

    if (githubAccounts.length >= 1) {
      const { addAnother } = await inquirer.prompt<{ addAnother: boolean }>([
        {
          type: 'confirm',
          name: 'addAnother',
          message: 'Add another GitHub account?',
          default: false,
        },
      ]);
      addMoreGitHub = addAnother;
    }
  }

  consola.info(`✅ Configured ${githubAccounts.length} GitHub account(s)`);

  // Bitbucket Setup
  const { useBitbucket } = await inquirer.prompt<{ useBitbucket: boolean }>([
    {
      type: 'confirm',
      name: 'useBitbucket',
      message: 'Do you use Bitbucket?',
      default: false,
    },
  ]);

  const bitbucketWorkspaces: Array<{
    workspace: string;
    username: string;
    userDisplayName: string;
    tokenEnvVar: string;
  }> = [];

  if (useBitbucket) {
    consola.box('Bitbucket Configuration');
    consola.info('Bitbucket requires an App Password with these permissions:');
    consola.info('  - Pull requests: Read');
    consola.info('  - Account: Read');
    consola.info('Create one at: https://bitbucket.org/account/settings/app-passwords/');

    let addMoreBitbucket = true;

    while (addMoreBitbucket) {
      const { workspace, username, userDisplayName, tokenEnvVar, validateNow } =
        await inquirer.prompt<{
          workspace: string;
          username: string;
          userDisplayName: string;
          tokenEnvVar: string;
          validateNow: boolean;
          // @ts-expect-error - TypeScript cannot infer inquirer's complex overload types, but code is correct
        }>([
          {
            type: 'input',
            name: 'workspace',
            message: 'Bitbucket workspace slug:',
            validate: (input: string) => input.trim().length > 0 || 'Workspace is required',
          },
          {
            type: 'input',
            name: 'username',
            message: 'Bitbucket username:',
            validate: (input: string) => input.trim().length > 0 || 'Username is required',
          },
          {
            type: 'input',
            name: 'userDisplayName',
            message: 'Your display name (for PR matching):',
            validate: (input: string) => input.trim().length > 0 || 'Display name is required',
          },
          {
            type: 'input',
            name: 'tokenEnvVar',
            message: 'Environment variable name for app password:',
            default: (answers: { workspace: string }) =>
              `BITBUCKET_TOKEN_${answers.workspace.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
            validate: (input: string) =>
              /^[A-Z][A-Z0-9_]*$/.test(input) ||
              'Must be uppercase letters, numbers, and underscores only',
          },
          {
            type: 'confirm',
            name: 'validateNow',
            message: 'Validate app password now? (must be in environment)',
            default: false,
          },
        ]);

      // Validate token if requested
      if (validateNow) {
        const token = process.env[tokenEnvVar];
        if (!token) {
          consola.warn(`⚠️  Environment variable ${tokenEnvVar} not found. Skipping validation.`);
        } else {
          consola.start('Validating Bitbucket app password...');
          try {
            const validation = await validateBitbucketToken(workspace, username, token);
            if (validation.valid) {
              consola.success(`✅ App password valid! Authenticated as: ${validation.username}`);
            } else {
              consola.error(`❌ Validation failed: ${validation.error}`);
              const { continueAnyway } = await inquirer.prompt<{ continueAnyway: boolean }>([
                {
                  type: 'confirm',
                  name: 'continueAnyway',
                  message: 'Continue anyway?',
                  default: false,
                },
              ]);
              if (!continueAnyway) {
                continue;
              }
            }
          } catch (error) {
            consola.error('❌ Validation error:', error);
          }
        }
      }

      bitbucketWorkspaces.push({ workspace, username, userDisplayName, tokenEnvVar });

      if (bitbucketWorkspaces.length >= 1) {
        const { addAnother } = await inquirer.prompt<{ addAnother: boolean }>([
          {
            type: 'confirm',
            name: 'addAnother',
            message: 'Add another Bitbucket workspace?',
            default: false,
          },
        ]);
        addMoreBitbucket = addAnother;
      }
    }

    consola.info(`✅ Configured ${bitbucketWorkspaces.length} Bitbucket workspace(s)`);
  }

  // Watch interval
  const { watchInterval } = await inquirer.prompt<{
    watchInterval: number;
    // @ts-expect-error - TypeScript cannot infer inquirer's complex overload types, but code is correct
  }>([
    {
      type: 'number',
      name: 'watchInterval',
      message: 'Auto-refresh interval in watch mode (minutes):',
      default: 15,
      validate: (input: number) => input > 0 || 'Must be greater than 0',
    },
  ]);

  // Create config
  const config: Config = {
    github: {
      accounts: githubAccounts,
    },
    bitbucket: {
      workspaces: bitbucketWorkspaces,
    },
    skipBitbucket: !useBitbucket || bitbucketWorkspaces.length === 0,
    watchInterval,
  };

  // Save config
  const configPath = getConfigPath();
  saveConfig(config, configPath);

  consola.success(`✅ Configuration saved to: ${configPath}`);

  // Print setup instructions
  consola.box('🔐 Token Setup Instructions');
  consola.info('Before running prs, set these environment variables:\n');

  // GitHub tokens
  if (githubAccounts.length > 0) {
    console.log(chalk.cyan('GitHub:'));
    for (const account of githubAccounts) {
      console.log(chalk.dim(`  export ${account.tokenEnvVar}="your_github_pat_here"`));
    }
  }

  // Bitbucket tokens
  if (bitbucketWorkspaces.length > 0) {
    console.log(chalk.cyan('Bitbucket:'));
    for (const workspace of bitbucketWorkspaces) {
      console.log(
        chalk.dim(`  export ${workspace.tokenEnvVar}="your_bitbucket_app_password_here"`)
      );
    }
  }

  consola.info('💡 Add these to your shell profile (~/.bashrc, ~/.zshrc, etc.) to persist them.');
  consola.info('💡 Or use a .env file and load it before running prs.');

  return config;
}
