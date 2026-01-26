import chalk from 'chalk';
import boxen from 'boxen';
import logSymbols from 'log-symbols';
import inquirer from 'inquirer';
import { existsSync } from 'node:fs';
import { getConfigPath, loadConfig, saveConfig } from '../lib/config-loader.js';
import type { Config } from '../types/config.js';

/**
 * Show current configuration
 */
export function configShow() {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.log(`${logSymbols.warning} No configuration file found.`);
    console.log(chalk.dim(`Run ${chalk.cyan('prs init')} to create one.`));
    return;
  }

  const config = loadConfig();

  console.log(chalk.cyan('\n⚙️  PRS Configuration\n'));

  // Config file location
  console.log(chalk.bold('Config File:'));
  console.log(`  ${chalk.dim(configPath)}`);
  console.log();

  // General settings
  console.log(chalk.bold('General Settings:'));
  console.log(`  ${chalk.white('Watch Interval:')} ${chalk.green(config.watchInterval)} minutes`);
  console.log(
    `  ${chalk.white('Skip Bitbucket:')} ${config.skipBitbucket ? chalk.yellow('Yes') : chalk.green('No')}`
  );
  console.log();

  // GitHub accounts
  console.log(chalk.bold('GitHub Accounts:'));
  if (config.github.accounts.length === 0) {
    console.log(`  ${chalk.gray('No accounts configured')}`);
  } else {
    for (const account of config.github.accounts) {
      const hasToken = !!process.env[account.tokenEnvVar];
      const tokenStatus = hasToken ? chalk.green('✓ Token set') : chalk.red('✗ Token missing');

      console.log(`  ${chalk.white(account.username)} (${chalk.cyan(account.org)})`);
      console.log(`    ${chalk.dim('Token Env:')} ${account.tokenEnvVar} ${tokenStatus}`);
    }
  }
  console.log();

  // Bitbucket workspaces
  console.log(chalk.bold('Bitbucket Workspaces:'));
  if (config.bitbucket.workspaces.length === 0) {
    console.log(`  ${chalk.gray('No workspaces configured')}`);
  } else {
    for (const workspace of config.bitbucket.workspaces) {
      const hasToken = !!process.env[workspace.tokenEnvVar];
      const tokenStatus = hasToken ? chalk.green('✓ Token set') : chalk.red('✗ Token missing');

      console.log(`  ${chalk.white(workspace.workspace)} (@${chalk.cyan(workspace.username)})`);
      console.log(`    ${chalk.dim('Display:')} ${workspace.userDisplayName}`);
      console.log(`    ${chalk.dim('Token Env:')} ${workspace.tokenEnvVar} ${tokenStatus}`);
    }
  }
  console.log();
}

/**
 * Show configuration file path
 */
export function configPath() {
  const configPath = getConfigPath();
  console.log(configPath);
}

/**
 * Get a specific config value
 */
export function configGet(key: string) {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.error(`${logSymbols.error} No configuration file found.`);
    process.exit(1);
  }

  const config = loadConfig();

  switch (key) {
    case 'watchInterval':
      console.log(config.watchInterval);
      break;
    case 'skipBitbucket':
      console.log(config.skipBitbucket);
      break;
    default:
      console.error(`${logSymbols.error} Unknown config key: ${key}`);
      console.log(chalk.dim('Available keys: watchInterval, skipBitbucket'));
      process.exit(1);
  }
}

/**
 * Set a specific config value
 */
export function configSet(key: string, value: string) {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.error(`${logSymbols.error} No configuration file found.`);
    console.log(chalk.dim(`Run ${chalk.cyan('prs init')} to create one.`));
    process.exit(1);
  }

  const config = loadConfig();

  switch (key) {
    case 'watchInterval': {
      const interval = parseInt(value, 10);
      if (isNaN(interval) || interval < 1) {
        console.error(`${logSymbols.error} Invalid watch interval. Must be a positive number.`);
        process.exit(1);
      }
      config.watchInterval = interval;
      saveConfig(config, configPath);
      console.log(`${logSymbols.success} Watch interval set to ${chalk.green(interval)} minutes`);
      break;
    }
    case 'skipBitbucket': {
      const skip = value.toLowerCase() === 'true' || value === '1';
      config.skipBitbucket = skip;
      saveConfig(config, configPath);
      console.log(`${logSymbols.success} Skip Bitbucket set to ${chalk.green(skip)}`);
      break;
    }
    default:
      console.error(`${logSymbols.error} Unknown config key: ${key}`);
      console.log(chalk.dim('Available keys: watchInterval, skipBitbucket'));
      process.exit(1);
  }
}

/**
 * Interactive config editing
 */
export async function configEdit() {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.error(`${logSymbols.error} No configuration file found.`);
    console.log(chalk.dim(`Run ${chalk.cyan('prs init')} to create one.`));
    process.exit(1);
  }

  const config = loadConfig();

  console.log(chalk.cyan('\n⚙️  Edit Configuration\n'));

  const { watchInterval } = await inquirer.prompt<{ watchInterval: number }>({
    type: 'number',
    name: 'watchInterval',
    message: 'Watch interval (minutes):',
    default: config.watchInterval,
    validate: (input: number | undefined) => {
      if (input === undefined || isNaN(input) || input < 1) {
        return 'Please enter a positive number';
      }
      return true;
    },
  });

  const { skipBitbucket } = await inquirer.prompt<{ skipBitbucket: boolean }>({
    type: 'confirm',
    name: 'skipBitbucket',
    message: 'Skip Bitbucket checks?',
    default: config.skipBitbucket,
  });

  config.watchInterval = watchInterval;
  config.skipBitbucket = skipBitbucket;

  saveConfig(config, configPath);

  console.log();
  console.log(`${logSymbols.success} Configuration updated!`);
  console.log();
}

/**
 * Reset configuration (with confirmation)
 */
export async function configReset() {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    console.log(`${logSymbols.info} No configuration file to reset.`);
    return;
  }

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow(
        'Are you sure you want to reset the configuration? This will remove all accounts and settings.'
      ),
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('Reset cancelled.'));
    return;
  }

  const emptyConfig: Config = {
    github: {
      accounts: [],
    },
    bitbucket: {
      workspaces: [],
    },
    skipBitbucket: false,
    watchInterval: 15,
  };

  saveConfig(emptyConfig, configPath);
  console.log(`${logSymbols.success} Configuration has been reset.`);
  console.log(chalk.dim(`Run ${chalk.cyan('prs init')} to set up accounts again.`));
}

/**
 * Show config help
 */
export function configHelp() {
  console.log(
    boxen(
      chalk.bold.cyan('⚙️  PRS Configuration Guide\n\n') +
        chalk.bold('Configuration File:\n') +
        chalk.gray('PRS stores configuration in JSON format. The file contains\n') +
        chalk.gray('account details and settings, but never stores tokens.\n\n') +
        chalk.bold('File Locations (priority order):\n') +
        chalk.white('  1. ') +
        chalk.cyan('.prs.json') +
        chalk.gray(' (local project)\n') +
        chalk.white('  2. ') +
        chalk.cyan('~/hemsoft/prs/config.json') +
        chalk.gray(' (recommended)\n') +
        chalk.white('  3. ') +
        chalk.cyan('~/.prs.json') +
        chalk.gray(' (legacy)\n\n') +
        chalk.bold('Commands:\n') +
        chalk.cyan('  prs config         ') +
        chalk.gray(' - Show current configuration\n') +
        chalk.cyan('  prs config show    ') +
        chalk.gray(' - Show current configuration\n') +
        chalk.cyan('  prs config path    ') +
        chalk.gray(' - Print config file path\n') +
        chalk.cyan('  prs config edit    ') +
        chalk.gray(' - Interactive config editing\n') +
        chalk.cyan('  prs config get <k> ') +
        chalk.gray(' - Get a specific setting\n') +
        chalk.cyan('  prs config set <k> <v>') +
        chalk.gray(' - Set a specific setting\n') +
        chalk.cyan('  prs config reset   ') +
        chalk.gray(' - Reset to empty configuration\n') +
        chalk.cyan('  prs config help    ') +
        chalk.gray(' - Show this help\n\n') +
        chalk.bold('Available Settings:\n') +
        chalk.cyan('  watchInterval') +
        chalk.gray('  - Refresh interval in minutes (default: 15)\n') +
        chalk.cyan('  skipBitbucket') +
        chalk.gray('  - Skip Bitbucket checks (true/false)\n\n') +
        chalk.bold('Examples:\n') +
        chalk.dim('  $ prs config set watchInterval 5\n') +
        chalk.dim('  $ prs config get watchInterval\n') +
        chalk.dim('  $ prs config set skipBitbucket true\n\n') +
        chalk.bold('Account Management:\n') +
        chalk.gray('To add or modify accounts, run:\n') +
        chalk.cyan('  prs init'),
      {
        padding: 1,
        borderColor: 'cyan',
        borderStyle: 'round',
      }
    )
  );
}
