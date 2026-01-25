#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import gradient from 'gradient-string';
import { hello } from './commands/hello.js';
import {
  showConfig,
  listModels,
  setConfigValue,
  resetConfigCommand,
  runFirstTimeSetup,
} from './commands/config.js';
import { authStatus, authLogin, authSwitch, authLogout, authHelp } from './commands/auth.js';
import { isFirstRun } from './lib/config.js';
import { showBanner } from './lib/banner.js';

// Custom gradient for help styling
const sectionGradient = gradient(['#00f0ff', '#00ff87']);

const program = new Command();

// Style help output text
function styleHelpText(text: string): string {
  const lines = text.split('\n');
  let foundUsage = false;
  let descriptionStyled = false;
  let skipNextBlank = false;

  const styledLines: string[] = [];

  for (const line of lines) {
    // Track when we've passed Usage line
    if (line.includes('Usage:')) {
      foundUsage = true;
      styledLines.push(chalk.hex('#00f0ff').bold('⚡ ') + line);
      continue;
    }

    // Style the description (first non-empty line after empty line following Usage)
    if (
      foundUsage &&
      !descriptionStyled &&
      line.trim() &&
      !line.startsWith('  ') &&
      !line.includes('Options:') &&
      !line.includes('Commands:')
    ) {
      descriptionStyled = true;
      skipNextBlank = true;
      styledLines.push(chalk.italic.hex('#ffd700')(line) + chalk.yellow(' ✨'));
      continue;
    }

    // Skip the blank line after description
    if (skipNextBlank && line.trim() === '') {
      skipNextBlank = false;
      continue;
    }

    // Style section headers
    if (line.trim() === 'Options:') {
      styledLines.push(
        '\n' +
          sectionGradient('┌──') +
          chalk.bold.hex('#00ff87')(' ⚙ Options ') +
          sectionGradient('──────────────────────────────────────────┐')
      );
      continue;
    }
    if (line.trim() === 'Commands:') {
      styledLines.push(
        '\n' +
          sectionGradient('┌──') +
          chalk.bold.hex('#00ff87')(' ⌘ Commands ') +
          sectionGradient('─────────────────────────────────────────┐')
      );
      continue;
    }
    if (line.trim() === 'Arguments:') {
      styledLines.push(
        '\n' +
          sectionGradient('┌──') +
          chalk.bold.hex('#00ff87')(' ⟨⟩ Arguments ') +
          sectionGradient('───────────────────────────────────────┐')
      );
      continue;
    }

    styledLines.push(line);
  }

  return styledLines.join('\n');
}

// Configure styled output for all commands
program.configureOutput({
  writeOut: (str) => process.stdout.write(styleHelpText(str)),
  writeErr: (str) => process.stderr.write(chalk.red(str)),
});

// Store global model option
let globalModel: string | undefined;

program
  .name('hs-cli')
  .description('A production-ready CLI template with AI capabilities')
  .version('1.0.0')
  .option('-m, --model <model>', 'Override the default model for this command')
  .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    globalModel = opts.model;

    // Skip first-run for config and auth commands
    const commandName = thisCommand.args[0];
    if (commandName === 'config' || commandName === 'auth') return;

    // Check for first run
    if (isFirstRun()) {
      const success = await runFirstTimeSetup();
      if (!success) {
        process.exit(1);
      }
    }
  });

// Config commands
const configCmd = program.command('config').description('Manage CLI configuration');

configCmd
  .command('show')
  .description('Show current configuration and auth status')
  .action(showConfig);

configCmd
  .command('models')
  .description('List available AI models')
  .option('-s, --select', 'Interactively select default model')
  .action(listModels);

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value (model)')
  .action(setConfigValue);

configCmd.command('reset').description('Reset configuration to defaults').action(resetConfigCommand);

// Auth commands
const authCmd = program.command('auth').description('Manage GitHub authentication');

authCmd.command('status').description('Show current authentication status').action(authStatus);

authCmd
  .command('login')
  .description('Log in to GitHub')
  .option('-w, --web', 'Use web browser for authentication')
  .action(authLogin);

authCmd.command('switch').description('Switch between GitHub accounts').action(authSwitch);

authCmd.command('logout').description('Log out from GitHub').action(authLogout);

authCmd.command('help').description('Show authentication guide').action(authHelp);

// Demo hello command
program
  .command('hello')
  .description('Demo command showing AI integration')
  .option('-n, --name <name>', 'Name to greet', 'World')
  .showHelpAfterError(true)
  .action((options) => hello({ ...options, model: globalModel }));

// If no arguments provided, show banner and help
if (process.argv.length === 2) {
  showBanner();
  program.help({ error: false });
}

program.parse();
