import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import logSymbols from 'log-symbols';
import { CopilotClient } from '@github/copilot-sdk';
import { loadConfig } from '../lib/config-loader.js';
import { validateGitHubToken, validateBitbucketToken } from '../utils/token-validator.js';

/**
 * Show detailed auth status for all configured accounts/workspaces
 */
export async function authStatus() {
  const spinner = ora('Loading configuration...').start();

  try {
    const config = loadConfig();
    spinner.stop();

    console.log(chalk.cyan('\n🔐 Authentication Status\n'));

    // GitHub Status
    console.log(chalk.bold('GitHub Accounts:'));
    if (config.github.accounts.length === 0) {
      console.log(`  ${chalk.gray('No accounts configured')}`);
    } else {
      for (const account of config.github.accounts) {
        const token = process.env[account.tokenEnvVar];

        if (!token) {
          console.log(
            `  ${logSymbols.error} ${chalk.white(account.username)} (${account.org}) - ${chalk.red('Token not set')}`
          );
          console.log(`    ${chalk.dim(`Missing: ${account.tokenEnvVar}`)}`);
        } else {
          spinner.start(`Validating ${account.username}...`);
          const validation = await validateGitHubToken(token);
          spinner.stop();

          if (validation.valid) {
            console.log(
              `  ${logSymbols.success} ${chalk.green(account.username)} (${account.org}) - ${chalk.green('Valid')}`
            );
            console.log(`    ${chalk.dim(`Env: ${account.tokenEnvVar}`)}`);
          } else {
            console.log(
              `  ${logSymbols.error} ${chalk.white(account.username)} (${account.org}) - ${chalk.red('Invalid')}`
            );
            console.log(`    ${chalk.dim(`Error: ${validation.error}`)}`);
          }
        }
      }
    }

    // Bitbucket Status
    console.log(chalk.bold('\nBitbucket Workspaces:'));
    if (config.skipBitbucket || config.bitbucket.workspaces.length === 0) {
      console.log(`  ${chalk.gray('No workspaces configured')}`);
    } else {
      for (const workspace of config.bitbucket.workspaces) {
        const token = process.env[workspace.tokenEnvVar];

        if (!token) {
          console.log(
            `  ${logSymbols.error} ${chalk.white(workspace.workspace)} (@${workspace.username}) - ${chalk.red('Token not set')}`
          );
          console.log(`    ${chalk.dim(`Missing: ${workspace.tokenEnvVar}`)}`);
        } else {
          spinner.start(`Validating ${workspace.workspace}...`);
          const validation = await validateBitbucketToken(
            workspace.workspace,
            workspace.username,
            token
          );
          spinner.stop();

          if (validation.valid) {
            console.log(
              `  ${logSymbols.success} ${chalk.green(workspace.workspace)} (@${workspace.username}) - ${chalk.green('Valid')}`
            );
            console.log(`    ${chalk.dim(`Env: ${workspace.tokenEnvVar}`)}`);
          } else {
            console.log(
              `  ${logSymbols.error} ${chalk.white(workspace.workspace)} (@${workspace.username}) - ${chalk.red('Invalid')}`
            );
            console.log(`    ${chalk.dim(`Error: ${validation.error}`)}`);
          }
        }
      }
    }

    // Copilot Status
    console.log(chalk.bold('\nGitHub Copilot:'));
    const client = new CopilotClient();
    try {
      await client.start();
      const copilotAuth = await client.getAuthStatus();

      if (copilotAuth.isAuthenticated) {
        console.log(
          `  ${logSymbols.success} Authenticated as ${chalk.green(copilotAuth.login || 'unknown')}`
        );
        console.log(`  ${chalk.gray(`Type: ${copilotAuth.authType || 'unknown'}`)}`);
      } else {
        console.log(`  ${logSymbols.error} ${chalk.red('Not authenticated')}`);
        console.log(`  ${chalk.dim('Copilot requires authentication via copilot CLI')}`);
        console.log(`  ${chalk.dim('Run: copilot auth login')}`);
      }
    } catch (error) {
      console.log(`  ${logSymbols.error} ${chalk.red('Error checking Copilot status')}`);
      console.log(`  ${chalk.dim(error instanceof Error ? error.message : 'Unknown error')}`);
    } finally {
      await client.stop();
    }

    // Summary
    const totalGithub = config.github.accounts.length;
    const totalBitbucket = config.skipBitbucket ? 0 : config.bitbucket.workspaces.length;

    console.log();
    console.log(
      chalk.dim(`Total: ${totalGithub} GitHub account(s), ${totalBitbucket} Bitbucket workspace(s)`)
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to check auth status');
    console.error(
      chalk.red(logSymbols.error),
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Show auth help - explains the token-based authentication system
 */
export function authHelp() {
  console.log(
    boxen(
      chalk.bold.cyan('🔐 PRS Authentication Guide\n\n') +
        chalk.bold('How Authentication Works:\n') +
        chalk.gray('PRS uses Personal Access Tokens (GitHub) and App Passwords\n') +
        chalk.gray('(Bitbucket) stored in environment variables for authentication.\n\n') +
        chalk.bold('Setup:\n') +
        chalk.white('  1. Run ') +
        chalk.cyan('prs config') +
        chalk.white(' to configure accounts/workspaces\n') +
        chalk.white('  2. Create tokens as instructed\n') +
        chalk.white('  3. Set environment variables with your tokens\n') +
        chalk.white('  4. Run ') +
        chalk.cyan('prs auth status') +
        chalk.white(' to verify\n\n') +
        chalk.bold('Creating Tokens:\n\n') +
        chalk.cyan('GitHub Personal Access Token:\n') +
        chalk.gray('  • Visit: ') +
        chalk.white('https://github.com/settings/tokens/new\n') +
        chalk.gray('  • Required scopes: ') +
        chalk.white('repo, read:org\n') +
        chalk.gray('  • Expiration: ') +
        chalk.white('Choose based on security needs\n\n') +
        chalk.cyan('Bitbucket App Password:\n') +
        chalk.gray('  • Visit: ') +
        chalk.white('https://bitbucket.org/account/settings/app-passwords/\n') +
        chalk.gray('  • Required permissions: ') +
        chalk.white('Pull requests (Read), Account (Read)\n\n') +
        chalk.bold('Setting Environment Variables:\n\n') +
        chalk.cyan('Bash/Zsh (~/.bashrc or ~/.zshrc):\n') +
        chalk.dim('  export GITHUB_TOKEN_USERNAME="ghp_..."\n') +
        chalk.dim('  export BITBUCKET_TOKEN_WORKSPACE="..."\n\n') +
        chalk.cyan('PowerShell ($PROFILE):\n') +
        chalk.dim('  $env:GITHUB_TOKEN_USERNAME="ghp_..."\n') +
        chalk.dim('  $env:BITBUCKET_TOKEN_WORKSPACE="..."\n\n') +
        chalk.cyan('Fish (~/.config/fish/config.fish):\n') +
        chalk.dim('  set -gx GITHUB_TOKEN_USERNAME "ghp_..."\n') +
        chalk.dim('  set -gx BITBUCKET_TOKEN_WORKSPACE "..."\n\n') +
        chalk.bold('Commands:\n') +
        chalk.cyan('  prs auth status  ') +
        chalk.gray(' - Check all configured accounts/tokens\n') +
        chalk.cyan('  prs auth help    ') +
        chalk.gray(' - Show this help message\n') +
        chalk.cyan('  prs config       ') +
        chalk.gray(' - Run setup wizard to configure accounts\n\n') +
        chalk.bold('Security Notes:\n') +
        chalk.gray('• Never commit tokens to version control\n') +
        chalk.gray('• Use different tokens for different machines\n') +
        chalk.gray('• Rotate tokens periodically\n') +
        chalk.gray('• Set appropriate expiration dates\n') +
        chalk.gray('• Revoke tokens when no longer needed\n\n') +
        chalk.bold('Troubleshooting:\n') +
        chalk.gray('• "Token not set" → Set the environment variable\n') +
        chalk.gray('• "Invalid" → Check token expiration and scopes\n') +
        chalk.gray('• "Insufficient scopes" → Recreate token with correct scopes'),
      {
        padding: 1,
        borderColor: 'cyan',
        borderStyle: 'round',
      }
    )
  );
}
