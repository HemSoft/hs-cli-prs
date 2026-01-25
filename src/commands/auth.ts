import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import logSymbols from 'log-symbols';
import { CopilotClient } from '@github/copilot-sdk';
import { execSync, spawn } from 'child_process';

/**
 * Check if GitHub CLI is installed
 */
function isGhInstalled(): boolean {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get gh auth status
 */
function getGhAuthStatus(): {
  authenticated: boolean;
  accounts: string[];
  active: string | undefined;
} {
  try {
    const output = execSync('gh auth status 2>&1', { encoding: 'utf-8' });
    const accounts: string[] = [];
    let active: string | undefined;

    // Parse output for accounts
    const lines = output.split('\n');
    for (const line of lines) {
      // Look for "Logged in to github.com account <username>"
      const accountMatch = line.match(/Logged in to .+ account (\S+)/);
      if (accountMatch && accountMatch[1]) {
        accounts.push(accountMatch[1]);
        active = accountMatch[1];
      }
    }

    return { authenticated: accounts.length > 0, accounts, active };
  } catch (error) {
    // gh auth status exits with 1 if not authenticated
    const output = (error as { stdout?: string; stderr?: string }).stderr || '';
    if (output.includes('not logged in')) {
      return { authenticated: false, accounts: [], active: undefined };
    }
    return { authenticated: false, accounts: [], active: undefined };
  }
}

/**
 * Show detailed auth status
 */
export async function authStatus() {
  const client = new CopilotClient();
  const spinner = ora();

  try {
    // Check GitHub CLI
    if (!isGhInstalled()) {
      console.log(
        boxen(
          chalk.red('GitHub CLI (gh) is not installed!\n\n') +
            chalk.white('HS CLI uses the GitHub CLI for authentication.\n\n') +
            chalk.bold('Installation:\n') +
            chalk.cyan('  Windows:  ') +
            chalk.white('winget install GitHub.cli\n') +
            chalk.cyan('  macOS:    ') +
            chalk.white('brew install gh\n') +
            chalk.cyan('  Linux:    ') +
            chalk.white('See https://github.com/cli/cli#installation\n'),
          {
            padding: 1,
            borderColor: 'red',
            title: '🔐 GitHub CLI Required',
            titleAlignment: 'center',
          }
        )
      );
      return;
    }

    spinner.start('Checking authentication status...');

    // Get Copilot auth status
    await client.start();
    const copilotAuth = await client.getAuthStatus();

    // Get GitHub CLI status
    const ghStatus = getGhAuthStatus();

    spinner.stop();

    console.log(chalk.cyan('\n🔐 Authentication Status\n'));

    // GitHub CLI Status
    console.log(chalk.bold('GitHub CLI:'));
    if (ghStatus.authenticated) {
      console.log(
        `  ${logSymbols.success} Logged in as ${chalk.green(ghStatus.active || 'unknown')}`
      );
      if (ghStatus.accounts.length > 1) {
        console.log(`  ${chalk.gray(`Available accounts: ${ghStatus.accounts.join(', ')}`)}`);
      }
    } else {
      console.log(`  ${logSymbols.error} ${chalk.red('Not logged in')}`);
    }

    // Copilot Status
    console.log(chalk.bold('\nGitHub Copilot:'));
    if (copilotAuth.isAuthenticated) {
      console.log(
        `  ${logSymbols.success} Authenticated as ${chalk.green(copilotAuth.login || 'unknown')}`
      );
      console.log(`  ${chalk.gray(`Type: ${copilotAuth.authType || 'unknown'}`)}`);
    } else {
      console.log(`  ${logSymbols.error} ${chalk.red('Not authenticated')}`);
    }

    // Show guidance if not authenticated
    if (!ghStatus.authenticated || !copilotAuth.isAuthenticated) {
      console.log();
      console.log(
        boxen(
          chalk.yellow('You need to authenticate to use HS CLI.\n\n') +
            chalk.white('Run: ') +
            chalk.cyan('hs-cli auth login') +
            chalk.white(' to authenticate.'),
          {
            padding: 1,
            borderColor: 'yellow',
            title: '⚠️ Action Required',
            titleAlignment: 'center',
          }
        )
      );
    } else {
      console.log(
        chalk.gray("\n✨ You're all set! Run ") +
          chalk.cyan('hs-cli --help') +
          chalk.gray(' to get started.\n')
      );
    }
  } catch (error) {
    spinner.fail('Failed to check auth status');
    console.error(
      chalk.red(logSymbols.error),
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    await client.stop();
  }
}

/**
 * Interactive login with GitHub CLI
 */
export async function authLogin(options: { web?: boolean }) {
  // Check GitHub CLI
  if (!isGhInstalled()) {
    console.log(
      boxen(
        chalk.red('GitHub CLI (gh) is not installed!\n\n') +
          chalk.white('HS CLI uses the GitHub CLI for authentication.\n\n') +
          chalk.bold('Installation:\n') +
          chalk.cyan('  Windows:  ') +
          chalk.white('winget install GitHub.cli\n') +
          chalk.cyan('  macOS:    ') +
          chalk.white('brew install gh\n') +
          chalk.cyan('  Linux:    ') +
          chalk.white('See https://github.com/cli/cli#installation\n'),
        {
          padding: 1,
          borderColor: 'red',
          title: '🔐 GitHub CLI Required',
          titleAlignment: 'center',
        }
      )
    );
    process.exit(1);
  }

  console.log(chalk.cyan('\n🔐 GitHub Authentication\n'));
  console.log(chalk.gray('Starting GitHub CLI authentication flow...\n'));

  // Build command args
  const args = ['auth', 'login'];
  if (options.web) {
    args.push('--web');
  }

  // Spawn gh auth login interactively
  const child = spawn('gh', args, {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', async (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n${logSymbols.success} Authentication successful!\n`));

      // Verify Copilot access
      const spinner = ora('Verifying Copilot access...').start();
      const client = new CopilotClient();
      try {
        await client.start();
        const auth = await client.getAuthStatus();
        if (auth.isAuthenticated) {
          spinner.succeed(`Copilot ready - logged in as ${chalk.green(auth.login || 'unknown')}`);
          console.log(
            chalk.gray("\n✨ You're all set! Run ") +
              chalk.cyan('hs-cli --help') +
              chalk.gray(' to get started.\n')
          );
        } else {
          spinner.warn('GitHub authenticated, but Copilot access could not be verified');
          console.log(chalk.yellow('\nMake sure you have GitHub Copilot enabled on your account.'));
          console.log(chalk.gray('Visit: https://github.com/settings/copilot\n'));
        }
      } catch {
        spinner.warn('Could not verify Copilot access');
      } finally {
        await client.stop();
      }
    } else {
      console.log(chalk.red(`\n${logSymbols.error} Authentication cancelled or failed.\n`));
    }
  });
}

/**
 * Switch between GitHub accounts
 */
export async function authSwitch() {
  // Check GitHub CLI
  if (!isGhInstalled()) {
    console.log(chalk.red(`${logSymbols.error} GitHub CLI (gh) is not installed.`));
    console.log(chalk.gray('Run: winget install GitHub.cli'));
    process.exit(1);
  }

  // Check current accounts
  const ghStatus = getGhAuthStatus();

  if (!ghStatus.authenticated) {
    console.log(
      chalk.yellow(`\n${logSymbols.warning} You're not logged in to any GitHub account.\n`)
    );
    console.log(
      chalk.white('Run: ') + chalk.cyan('hs-cli auth login') + chalk.white(' to authenticate.\n')
    );
    return;
  }

  console.log(chalk.cyan('\n🔄 Switch GitHub Account\n'));

  if (ghStatus.accounts.length === 1) {
    console.log(chalk.gray(`Currently logged in as: ${chalk.white(ghStatus.active)}\n`));
    console.log(chalk.yellow('You only have one account. To add another:\n'));
    console.log(chalk.white('1. Run: ') + chalk.cyan('hs-cli auth login'));
    console.log(chalk.white('2. Choose a different account when prompted\n'));
    return;
  }

  console.log(chalk.gray('Starting GitHub CLI account switcher...\n'));

  // Spawn gh auth switch interactively
  const child = spawn('gh', ['auth', 'switch'], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', async (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n${logSymbols.success} Account switched!\n`));

      // Show new status
      const newStatus = getGhAuthStatus();
      if (newStatus.active) {
        console.log(chalk.gray(`Now using: ${chalk.green(newStatus.active)}\n`));
      }
    }
  });
}

/**
 * Log out from GitHub
 */
export async function authLogout() {
  // Check GitHub CLI
  if (!isGhInstalled()) {
    console.log(chalk.red(`${logSymbols.error} GitHub CLI (gh) is not installed.`));
    process.exit(1);
  }

  const ghStatus = getGhAuthStatus();

  if (!ghStatus.authenticated) {
    console.log(chalk.yellow(`\n${logSymbols.info} You're not logged in to any GitHub account.\n`));
    return;
  }

  console.log(chalk.cyan('\n👋 GitHub Logout\n'));
  console.log(chalk.gray('Starting GitHub CLI logout...\n'));

  // Spawn gh auth logout interactively
  const child = spawn('gh', ['auth', 'logout'], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n${logSymbols.success} Logged out successfully.\n`));
    }
  });
}

/**
 * Show auth help - explains the authentication system
 */
export function authHelp() {
  console.log(
    boxen(
      chalk.bold.cyan('🔐 HS CLI Authentication Guide\n\n') +
        chalk.bold('How Authentication Works:\n') +
        chalk.gray('HS CLI uses GitHub Copilot, which requires GitHub\n') +
        chalk.gray('authentication. The GitHub CLI (gh) manages your credentials.\n\n') +
        chalk.bold('Prerequisites:\n') +
        chalk.white('  1. GitHub CLI installed (') +
        chalk.cyan('gh') +
        chalk.white(')\n') +
        chalk.white('  2. GitHub account with Copilot access\n') +
        chalk.white('  3. Copilot enabled at ') +
        chalk.cyan('github.com/settings/copilot') +
        chalk.white('\n\n') +
        chalk.bold('Commands:\n') +
        chalk.cyan('  hs-cli auth status  ') +
        chalk.gray(' - Check current auth status\n') +
        chalk.cyan('  hs-cli auth login   ') +
        chalk.gray(' - Log in to GitHub\n') +
        chalk.cyan('  hs-cli auth switch  ') +
        chalk.gray(' - Switch between accounts\n') +
        chalk.cyan('  hs-cli auth logout  ') +
        chalk.gray(' - Log out from GitHub\n\n') +
        chalk.bold('Multiple Accounts:\n') +
        chalk.gray('If you have multiple GitHub accounts (work/personal),\n') +
        chalk.gray('use ') +
        chalk.cyan('hs-cli auth switch') +
        chalk.gray(' to switch between them.\n') +
        chalk.gray('Each account must have Copilot access enabled.\n\n') +
        chalk.bold('SSH Keys:\n') +
        chalk.gray('During ') +
        chalk.cyan('gh auth login') +
        chalk.gray(', you may be asked to select\n') +
        chalk.gray('an SSH key. Choose the key associated with the GitHub\n') +
        chalk.gray('account you want to use (check key names for hints).\n\n') +
        chalk.bold('Troubleshooting:\n') +
        chalk.gray('• "Not authenticated" → Run ') +
        chalk.cyan('hs-cli auth login\n') +
        chalk.gray('• "Copilot not available" → Enable at github.com/settings/copilot\n') +
        chalk.gray('• Wrong account → Run ') +
        chalk.cyan('hs-cli auth switch'),
      {
        padding: 1,
        borderColor: 'cyan',
        borderStyle: 'round',
      }
    )
  );
}
