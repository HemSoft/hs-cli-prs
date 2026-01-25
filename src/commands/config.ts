import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import logSymbols from 'log-symbols';
import { CopilotClient } from '@github/copilot-sdk';
import { execSync } from 'child_process';
import {
  config,
  getConfigPath,
  setDefaultModel,
  saveAvailableModels,
  resolveModel,
  MODEL_ALIASES,
  resetConfig,
} from '../lib/config.js';

/**
 * Get gh auth status (source of truth)
 */
function getGhAuthStatus(): {
  authenticated: boolean;
  active: string | undefined;
  authType: string;
} {
  try {
    const output = execSync('gh auth status 2>&1', { encoding: 'utf-8' });
    let active: string | undefined;

    // Parse output for active account
    const lines = output.split('\n');
    for (const line of lines) {
      const accountMatch = line.match(/Logged in to .+ account (\S+)/);
      if (accountMatch && accountMatch[1]) {
        active = accountMatch[1];
        break;
      }
    }

    return { 
      authenticated: !!active, 
      active, 
      authType: 'gh-cli' 
    };
  } catch {
    return { 
      authenticated: false, 
      active: undefined, 
      authType: 'gh-cli' 
    };
  }
}

/**
 * Show current configuration and auth status
 */
export async function showConfig() {
  const spinner = ora();

  try {
    spinner.start('Checking status...');
    
    // Get GitHub CLI auth status (source of truth)
    const auth = getGhAuthStatus();
    
    spinner.stop();

    console.log(chalk.cyan('\n⚙️  HS CLI Configuration\n'));

    // Auth status
    console.log(chalk.bold('Authentication:'));
    if (auth.authenticated) {
      console.log(
        `  ${logSymbols.success} Authenticated as ${chalk.green(auth.active || 'unknown')}`
      );
      console.log(`  ${chalk.gray(`Type: ${auth.authType}`)}`);
    } else {
      console.log(`  ${logSymbols.error} ${chalk.red('Not authenticated')}`);
      console.log(`  ${chalk.yellow('Run: hs-cli auth login')}`);
    }

    // Current config
    console.log(chalk.bold('\nSettings:'));
    console.log(`  Default Model: ${chalk.cyan(config.get('defaultModel'))}`);

    // Aliases
    console.log(chalk.bold('\nModel Aliases:'));
    for (const [alias, model] of Object.entries(MODEL_ALIASES)) {
      console.log(`  ${chalk.yellow(alias)} → ${model}`);
    }

    console.log(chalk.gray(`\nConfig file: ${getConfigPath()}\n`));
  } catch (error) {
    spinner.fail('Failed to get status');
    console.error(
      chalk.red(logSymbols.error),
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * List and select available models
 */
export async function listModels(options: { select?: boolean }) {
  const client = new CopilotClient();
  const spinner = ora();

  try {
    spinner.start('Fetching available models...');
    await client.start();
    const models = await client.listModels();
    spinner.succeed(`Found ${models.length} models`);

    // Save to config
    saveAvailableModels(models.map((m) => m.id));

    const currentModel = config.get('defaultModel');

    console.log(chalk.cyan('\n📦 Available Models:\n'));
    for (const model of models) {
      const isCurrent = model.id === currentModel;
      const marker = isCurrent ? chalk.green('●') : chalk.gray('○');
      const billing = model.billing ? ` (${model.billing.multiplier}x)` : '';
      console.log(
        `  ${marker} ${isCurrent ? chalk.green(model.id) : model.id}${chalk.gray(billing)}`
      );
      if (model.name && model.name !== model.id) {
        console.log(`    ${chalk.gray(model.name)}`);
      }
    }

    if (options.select) {
      console.log();
      const { selectedModel } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedModel',
          message: 'Select default model:',
          choices: models.map((m) => ({
            name: `${m.id}${m.billing ? ` (${m.billing.multiplier}x)` : ''}`,
            value: m.id,
          })),
          default: currentModel,
        },
      ]);

      setDefaultModel(selectedModel);
      console.log(chalk.green(`\n${logSymbols.success} Default model set to: ${selectedModel}\n`));
    } else {
      console.log(chalk.gray('\nUse --select to change the default model.\n'));
    }
  } catch (error) {
    spinner.fail('Failed to list models');
    console.error(
      chalk.red(logSymbols.error),
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    await client.stop();
  }
}

/**
 * Set a configuration value
 */
export async function setConfigValue(key: string, value: string) {
  switch (key) {
    case 'model':
      setDefaultModel(value);
      console.log(
        chalk.green(`${logSymbols.success} Default model set to: ${resolveModel(value)}`)
      );
      break;
    default:
      console.log(chalk.red(`${logSymbols.error} Unknown config key: ${key}`));
      console.log(chalk.gray('Available keys: model'));
  }
}

/**
 * Reset configuration to defaults
 */
export async function resetConfigCommand() {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Reset all configuration to defaults?',
      default: false,
    },
  ]);

  if (confirmed) {
    resetConfig();
    console.log(chalk.green(`${logSymbols.success} Configuration reset to defaults.`));
  }
}

/**
 * First-run setup wizard
 */
export async function runFirstTimeSetup(): Promise<boolean> {
  const client = new CopilotClient();
  const spinner = ora();

  try {
    console.log(chalk.cyan('\n🚀 Welcome to HS CLI!\n'));
    console.log(chalk.gray("Let's get you set up...\n"));

    spinner.start('Checking authentication...');
    await client.start();
    const auth = await client.getAuthStatus();

    if (!auth.isAuthenticated) {
      spinner.fail('Not authenticated');
      console.log(chalk.yellow('\nYou need to authenticate with GitHub first.'));
      console.log(chalk.white('Run: ') + chalk.cyan('hs-cli auth login'));
      console.log(chalk.gray('\nThen run HS CLI again.\n'));
      await client.stop();
      return false;
    }

    spinner.succeed(`Authenticated as ${chalk.green(auth.login || 'unknown')}`);

    // Fetch models
    spinner.start('Fetching available models...');
    const models = await client.listModels();
    spinner.succeed(`Found ${models.length} models`);
    saveAvailableModels(models.map((m) => m.id));

    // Select default model
    console.log();
    const { selectedModel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: 'Select your default AI model:',
        choices: models.map((m) => ({
          name: `${m.id}${m.billing ? ` (${m.billing.multiplier}x)` : ''}`,
          value: m.id,
        })),
        default: 'claude-sonnet-4.5',
      },
    ]);

    setDefaultModel(selectedModel);

    // Complete setup
    config.set('firstRunComplete', true);

    console.log(chalk.green('\n✨ Setup complete!\n'));
    console.log(chalk.gray('You can change settings anytime with:'));
    console.log(chalk.white('  hs-cli config show     ') + chalk.gray('- View current config'));
    console.log(
      chalk.white('  hs-cli config models   ') + chalk.gray('- Select a different model')
    );
    console.log(
      chalk.white('  hs-cli --model <name>  ') + chalk.gray('- Use a model for one command')
    );
    console.log();

    return true;
  } catch (error) {
    spinner.fail('Setup failed');
    console.error(
      chalk.red(logSymbols.error),
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  } finally {
    await client.stop();
  }
}
