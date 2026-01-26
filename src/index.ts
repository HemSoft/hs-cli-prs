#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import Table from 'cli-table3';
import { Command } from 'commander';
import { consola } from 'consola';
import terminalLink from 'terminal-link';
import inquirer from 'inquirer';
import { BitbucketClient } from './api/bitbucket.js';
import { GitHubClient, type PullRequest } from './api/github.js';
import { getConfigPath, loadConfig, saveConfig } from './lib/config-loader.js';
import { showBanner } from './lib/banner.js';
import { runInteractiveSetup } from './utils/interactive-setup.js';
import { getRandomSplashText } from './utils/splash-texts.js';
import type { Config } from './types/config.js';
import {
  configShow,
  configPath,
  configGet,
  configSet,
  configEdit,
  configReset,
  configHelp,
} from './commands/config.js';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const program = new Command();

program
  .name('prs')
  .description('An AI-powered CLI tool for intelligent pull request monitoring')
  .version(version);

// Add init command
program
  .command('init')
  .description('Create a configuration file interactively')
  .action(async () => {
    try {
      await runInteractiveSetup();
    } catch (error) {
      consola.error('Setup failed:', error);
      process.exit(1);
    }
  });

// Add config command with subcommands
const configCommand = program
  .command('config')
  .description('View and manage configuration')
  .action(() => {
    // Default action: show config
    configShow();
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    configShow();
  });

configCommand
  .command('path')
  .description('Print config file path')
  .action(() => {
    configPath();
  });

configCommand
  .command('edit')
  .description('Interactive config editing')
  .action(async () => {
    await configEdit();
  });

configCommand
  .command('get <key>')
  .description('Get a specific config value')
  .action((key: string) => {
    configGet(key);
  });

configCommand
  .command('set <key> <value>')
  .description('Set a specific config value')
  .action((key: string, value: string) => {
    configSet(key, value);
  });

configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .action(async () => {
    await configReset();
  });

configCommand
  .command('help')
  .description('Show config help')
  .action(() => {
    configHelp();
  });

// Main command
program
  .option('-a, --approved-open', 'List PRs you have approved that are still open', false)
  .option(
    '-m, --approved-merged-since <date>',
    'List PRs you have approved that have been merged since the specified date (YYYY-MM-DD)'
  )
  .option('-o, --once', 'Run once and exit (default is watch mode)', false)
  .option('-w, --watch <minutes>', 'Refresh interval in minutes for watch mode', '15')
  .option('--skip-bitbucket', 'Skip Bitbucket checks (GitHub only)', false)
  .option('-d, --debug', 'Enable debug mode', false)
  .action(
    async (options: {
      approvedOpen: boolean;
      approvedMergedSince?: string;
      once: boolean;
      watch: string;
      skipBitbucket: boolean;
      debug: boolean;
    }) => {
      // Show HemSoft Developments branded banner
      showBanner({ version: `v${version}`, showTaglines: true });

      if (options.debug) {
        consola.level = 5;
        consola.debug('Debug mode enabled');
        consola.debug('Options:', options);
      }

      try {
        // Check if config exists first
        const configPath = getConfigPath();
        const hasConfig = existsSync(configPath);

        if (!hasConfig) {
          console.log('');
          consola.info(chalk.cyan('👋 Welcome to prs!'));
          console.log('');
          consola.info('It looks like this is your first time running prs.');
          consola.info("Let's get you set up with GitHub and/or Bitbucket accounts.");
          console.log('');

          const { shouldSetup } = await inquirer.prompt<{ shouldSetup: boolean }>([
            {
              type: 'confirm',
              name: 'shouldSetup',
              message: 'Would you like to configure prs now?',
              default: true,
            },
          ]);

          if (shouldSetup) {
            await runInteractiveSetup();
            consola.success('✅ Setup complete! Starting prs...');
            console.log('');
          } else {
            // Create a minimal starter config with empty arrays
            const starterConfig: Config = {
              github: {
                accounts: [],
              },
              bitbucket: {
                workspaces: [],
              },
              skipBitbucket: false,
              watchInterval: 15,
            };
            saveConfig(starterConfig, configPath);
            consola.info('Created starter configuration with no accounts.');
            consola.info('You can add accounts later by running: prs init');
            console.log('');
          }
        }

        // Load config (now guaranteed to exist)
        const config = loadConfig();

        if (options.skipBitbucket) {
          config.skipBitbucket = true;
        }

        const githubClient = new GitHubClient(config.github);
        const bitbucketClient = new BitbucketClient(config.bitbucket);
        const watchInterval = Number.parseInt(options.watch, 10);
        if (!Number.isNaN(watchInterval)) {
          config.watchInterval = watchInterval;
        }

        let mode: 'default' | 'approved-open' | 'approved-merged-since' = 'default';
        let dateStr: string | undefined;

        if (options.approvedOpen) {
          mode = 'approved-open';
        } else if (options.approvedMergedSince) {
          mode = 'approved-merged-since';
          if (!/^\d{4}-\d{2}-\d{2}$/.test(options.approvedMergedSince)) {
            consola.error('Invalid date format. Use YYYY-MM-DD');
            process.exit(1);
          }
          dateStr = options.approvedMergedSince;
        }

        const fetchAndDisplay = async (clearScreen = true, nextRefreshTime?: Date) => {
          let splashInterval: ReturnType<typeof setInterval> | undefined;
          const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
          let frameIndex = 0;
          let currentText = getRandomSplashText();
          let lastTextChange = Date.now();

          const updateSpinner = () => {
            if (Date.now() - lastTextChange > 3000) {
              currentText = getRandomSplashText();
              lastTextChange = Date.now();
            }

            const spinner = spinnerFrames[frameIndex % spinnerFrames.length];
            frameIndex++;

            process.stdout.write(`\r\x1b[K${chalk.cyan(spinner)} ${currentText}`);
          };

          splashInterval = setInterval(updateSpinner, 80);

          const [githubPRs, bitbucketPRs] = await Promise.all([
            githubClient.fetchPRs(mode, dateStr),
            config.skipBitbucket ? Promise.resolve([]) : bitbucketClient.fetchPRs(mode, dateStr),
          ]);

          if (splashInterval) {
            clearInterval(splashInterval);
          }
          process.stdout.write('\r\x1b[K');

          const allPRs: PullRequest[] = [...githubPRs, ...bitbucketPRs];

          if (allPRs.length === 0) {
            consola.success('✅ All clear! No PRs found.');
            return;
          }

          allPRs.sort((a, b) => {
            if (a.source !== b.source) {
              return a.source.localeCompare(b.source);
            }
            if (a.repository !== b.repository) {
              return a.repository.localeCompare(b.repository);
            }
            return a.id - b.id;
          });

          if (clearScreen) {
            console.clear();
            // Re-show banner after clear
            showBanner({ version: `v${version}`, showTaglines: true });
          }

          const terminalWidth = process.stdout.columns || 120;

          const fixedWidths = {
            approved: 11,
            src: 5,
            number: 6,
            author: 20,
            date: 13,
          };
          const totalFixed = Object.values(fixedWidths).reduce((a, b) => a + b, 0);
          const borders = 14;
          const repositoryWidth = Math.max(
            18,
            Math.floor((terminalWidth - totalFixed - borders) * 0.25)
          );
          const titleWidth = Math.max(30, terminalWidth - totalFixed - repositoryWidth - borders);

          const actualTableWidth = totalFixed + repositoryWidth + titleWidth + 8;

          const bannerWidth = actualTableWidth - 2;
          const titleText = `Pull Requests (${allPRs.length} total)`;
          const currentTime = new Date().toLocaleTimeString();
          const nextRefreshText = nextRefreshTime
            ? `Next refresh at ${nextRefreshTime.toLocaleTimeString()}`
            : '';

          // Build header with left/center/right alignment
          // Calculate visible character positions (excluding ANSI codes)
          const leftText = nextRefreshText;
          const rightText = currentTime;
          const centerText = titleText;

          // Total visible content: 1 space + leftText + spaces + centerText + spaces + rightText + 1 space
          const availableWidth = bannerWidth;
          const centerPos = Math.floor(availableWidth / 2);
          const centerStart = centerPos - Math.floor(centerText.length / 2);

          // Build the line character by character for precise alignment
          let line = ' ' + leftText;
          const spacesToCenter = Math.max(1, centerStart - line.length);
          line += ' '.repeat(spacesToCenter) + centerText;
          const spacesToRight = Math.max(1, availableWidth - line.length - rightText.length - 1);
          line += ' '.repeat(spacesToRight) + rightText + ' ';

          // Apply styling after calculating positions
          const styledLine =
            ' ' +
            chalk.dim(leftText) +
            ' '.repeat(spacesToCenter) +
            centerText +
            ' '.repeat(spacesToRight) +
            chalk.dim(rightText) +
            ' ';

          console.log(chalk.cyan.bold(`╔${'═'.repeat(bannerWidth)}╗`));
          console.log(chalk.cyan.bold('║') + styledLine + chalk.cyan.bold('║'));
          console.log(chalk.cyan.bold(`╚${'═'.repeat(bannerWidth)}╝`));

          const table = new Table({
            head: [
              chalk.cyan.bold('Approved'),
              chalk.cyan.bold('Src'),
              chalk.cyan.bold('Repository'),
              chalk.cyan.bold('#'),
              chalk.cyan.bold('Title'),
              chalk.cyan.bold('Author'),
              chalk.cyan.bold('Date'),
            ],
            style: {
              head: [],
              border: ['cyan'],
              compact: false,
            },
            chars: {
              top: '─',
              'top-mid': '┬',
              'top-left': '┌',
              'top-right': '┐',
              bottom: '─',
              'bottom-mid': '┴',
              'bottom-left': '└',
              'bottom-right': '┘',
              left: '│',
              'left-mid': '├',
              mid: '─',
              'mid-mid': '┼',
              right: '│',
              'right-mid': '┤',
              middle: '│',
            },
            colWidths: [
              fixedWidths.approved,
              fixedWidths.src,
              repositoryWidth,
              fixedWidths.number,
              titleWidth,
              fixedWidths.author,
              fixedWidths.date,
            ],
            wordWrap: false,
          });

          for (const pr of allPRs) {
            const total = pr.assigneeCount > 0 ? pr.assigneeCount.toString() : '?';
            const myApproval = pr.iApproved ? ' ✅' : '';
            const approvalStr = `${pr.approvalCount}/${total}${myApproval}`;

            const src = pr.source === 'GitHub' ? 'GH' : 'BB';

            let title = pr.title;
            const maxTitleLen = titleWidth - 4;
            if (title.length > maxTitleLen) {
              title = `${title.substring(0, maxTitleLen - 3)}...`;
            }

            // Create clickable link - force hyperlink mode since VS Code terminal
            // supports OSC 8 but isn't detected by supports-hyperlinks
            const titleLink = chalk.cyan(terminalLink(title, pr.url, { fallback: false }));

            let repoName = pr.repository;
            const maxRepoLen = repositoryWidth - 3;
            if (repoName.length > maxRepoLen) {
              repoName = `${repoName.substring(0, maxRepoLen - 3)}...`;
            }

            let author = pr.author;
            const maxAuthorLen = fixedWidths.author - 3;
            if (author.length > maxAuthorLen) {
              author = `${author.substring(0, maxAuthorLen - 3)}...`;
            }

            const dateStr = pr.created ? pr.created.toISOString().split('T')[0] : 'N/A';

            table.push([
              approvalStr,
              chalk.yellow(src),
              chalk.green(repoName),
              chalk.blue(`#${pr.id}`),
              titleLink,
              author,
              chalk.gray(dateStr),
            ]);
          }

          console.log(table.toString());
        };

        if (options.once) {
          await fetchAndDisplay(false);
        } else {
          let firstRun = true;
          while (true) {
            const nextRun = new Date();
            nextRun.setMinutes(nextRun.getMinutes() + config.watchInterval);
            await fetchAndDisplay(!firstRun, nextRun);
            firstRun = false;
            await new Promise((resolve) => setTimeout(resolve, config.watchInterval * 60 * 1000));
          }
        }

        process.exit(0);
      } catch (error) {
        consola.error('Failed:', error);
        process.exit(1);
      }
    }
  );

// Custom help display with banner at the top
program.addHelpText('beforeAll', () => {
  const lines = [];
  lines.push('');
  // Capture banner output
  const originalLog = console.log;
  const bannerLines: string[] = [];
  console.log = (...args: unknown[]) => {
    bannerLines.push(args.join(' '));
  };
  showBanner({ version: `v${version}`, showTaglines: true });
  console.log = originalLog;

  lines.push(...bannerLines);
  return lines.join('\n');
});

program.addHelpText('after', () => {
  const lines = [];
  lines.push('');
  lines.push(chalk.dim('  Examples:'));
  lines.push('');
  lines.push(
    chalk.cyan('    $ prs') +
      chalk.dim('                              # Start watching PRs (15min intervals)')
  );
  lines.push(
    chalk.cyan('    $ prs --once') + chalk.dim('                       # Check PRs once and exit')
  );
  lines.push(
    chalk.cyan('    $ prs --approved-open --once') +
      chalk.dim('       # Show approved PRs still open')
  );
  lines.push(
    chalk.cyan('    $ prs --approved-merged-since 2026-01-01') +
      chalk.dim(' # Recently merged PRs you approved')
  );
  lines.push(
    chalk.cyan('    $ prs --watch 5') +
      chalk.dim('                     # Watch mode with 5min intervals')
  );
  lines.push(
    chalk.cyan('    $ prs init') +
      chalk.dim('                         # Run interactive setup wizard')
  );
  lines.push(
    chalk.cyan('    $ prs config') +
      chalk.dim('                       # Show current configuration')
  );
  lines.push(
    chalk.cyan('    $ prs config set watchInterval 5') +
      chalk.dim('  # Set watch interval to 5 minutes')
  );
  lines.push('');
  return lines.join('\n');
});

program.parse();
