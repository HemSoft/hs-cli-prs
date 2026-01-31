#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import Table from 'cli-table3';
import { Command } from 'commander';
import { consola } from 'consola';
import inquirer from 'inquirer';
import { BitbucketClient } from './api/bitbucket.js';
import { GitHubClient, type PullRequest, type StaleRepository } from './api/github.js';
import { getConfigPath, loadConfig, saveConfig } from './lib/config-loader.js';
import { showBanner } from './lib/banner.js';
import { runInteractiveSetup } from './utils/interactive-setup.js';
import { getRandomSplashText } from './utils/splash-texts.js';

/**
 * Create an OSC 8 hyperlink that works in VS Code terminal and other modern terminals.
 * The terminal-link package doesn't force hyperlinks when terminal detection fails,
 * so we manually create OSC 8 escape sequences.
 */
function hyperlink(text: string, url: string): string {
  // OSC 8 hyperlink format: \x1b]8;;URL\x07TEXT\x1b]8;;\x07
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

/**
 * Log to file if log file path is provided
 */
function logToFile(logFile: string | undefined, message: string) {
  if (logFile) {
    const timestamp = new Date().toISOString();
    appendFileSync(logFile, `[${timestamp}] ${message}\n`, 'utf-8');
  }
}
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
  .option('-s, --stale-prs', 'Find stale PRs (open longer than threshold)', false)
  .option('--stale-days <days>', 'Number of days threshold for stale PRs (default: 90)', '90')
  .option('--stale-limit <n>', 'Limit number of stale PRs to display (oldest first)')
  .option('--stale-repos <days>', 'Find repositories with no commits in <days> days')
  .option('-o, --once', 'Run once and exit (default is watch mode)', false)
  .option('-w, --watch <minutes>', 'Refresh interval in minutes for watch mode', '15')
  .option('--skip-bitbucket', 'Skip Bitbucket checks (GitHub only)', false)
  .option('--clear', 'Clear screen before starting the app', false)
  .option('--log-file <path>', 'Write errors and events to a log file')
  .option('-d, --debug', 'Enable debug mode', false)
  .action(
    async (options: {
      approvedOpen: boolean;
      approvedMergedSince?: string;
      stalePrs: boolean;
      staleDays: string;
      staleLimit?: string;
      staleRepos?: string;
      once: boolean;
      watch: string;
      skipBitbucket: boolean;
      clear: boolean;
      logFile?: string;
      debug: boolean;
    }) => {
      // Clear screen if requested
      if (options.clear) {
        console.clear();
      }

      // Show HemSoft Developments branded banner
      showBanner({ version: `v${version}`, showTaglines: true });

      if (options.debug) {
        consola.level = 5;
        consola.debug('Debug mode enabled');
        consola.debug('Options:', options);
        consola.debug(`Process ID: ${process.pid}`);
        consola.debug(`Node version: ${process.version}`);
        consola.debug(`Platform: ${process.platform} ${process.arch}`);
        consola.debug(`Working directory: ${process.cwd()}`);
        const memUsage = process.memoryUsage();
        consola.debug(
          `Initial memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        );
      }

      // Initialize log file if specified
      if (options.logFile) {
        logToFile(options.logFile, '='.repeat(80));
        logToFile(options.logFile, `PRS CLI Started - Version ${version}`);
        logToFile(options.logFile, `Process ID: ${process.pid}`);
        logToFile(options.logFile, `Node version: ${process.version}`);
        logToFile(options.logFile, `Platform: ${process.platform} ${process.arch}`);
        logToFile(options.logFile, `Mode: ${options.once ? 'once' : 'watch'}`);
        logToFile(options.logFile, `Options: ${JSON.stringify(options)}`);
        const memUsage = process.memoryUsage();
        logToFile(
          options.logFile,
          `Initial memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, HeapUsed=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        );
        logToFile(options.logFile, '='.repeat(80));
        consola.info(`Logging to: ${chalk.dim(options.logFile)}`);
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

        let mode: 'default' | 'approved-open' | 'approved-merged-since' | 'stale' | 'stale-repos' =
          'default';
        let dateStr: string | undefined;
        let staleDays = 90;
        let staleLimit: number | undefined;
        let staleReposDays: number | undefined;

        // --stale-repos mode
        if (options.staleRepos) {
          mode = 'stale-repos';
          staleReposDays = Number.parseInt(options.staleRepos, 10);
          if (Number.isNaN(staleReposDays) || staleReposDays < 1) {
            consola.error('Invalid stale-repos value. Must be a positive number of days.');
            process.exit(1);
          }
          // Use stale-limit for repos too, default 50
          if (options.staleLimit) {
            staleLimit = Number.parseInt(options.staleLimit, 10);
            if (Number.isNaN(staleLimit) || staleLimit < 1) {
              consola.error('Invalid stale-limit value. Must be a positive number.');
              process.exit(1);
            }
          } else {
            staleLimit = 50;
          }
        }
        // --stale-prs or --stale-days implies stale mode
        else if (options.stalePrs || options.staleDays !== '90' || options.staleLimit) {
          mode = 'stale';
          staleDays = Number.parseInt(options.staleDays, 10);
          if (Number.isNaN(staleDays) || staleDays < 1) {
            consola.error('Invalid stale-days value. Must be a positive number.');
            process.exit(1);
          }
          if (options.staleLimit) {
            staleLimit = Number.parseInt(options.staleLimit, 10);
            if (Number.isNaN(staleLimit) || staleLimit < 1) {
              consola.error('Invalid stale-limit value. Must be a positive number.');
              process.exit(1);
            }
          } else {
            // Default limit to prevent runaway queries
            staleLimit = 50;
          }
        } else if (options.approvedOpen) {
          mode = 'approved-open';
        } else if (options.approvedMergedSince) {
          mode = 'approved-merged-since';
          if (!/^\d{4}-\d{2}-\d{2}$/.test(options.approvedMergedSince)) {
            consola.error('Invalid date format. Use YYYY-MM-DD');
            process.exit(1);
          }
          dateStr = options.approvedMergedSince;
        }

        // Stale mode and stale-repos mode always run once (no watch mode)
        const runOnce = mode === 'stale' || mode === 'stale-repos' ? true : options.once;

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

          // Handle stale-repos mode separately
          if (mode === 'stale-repos' && staleReposDays) {
            const [githubRepos, bitbucketRepos] = await Promise.all([
              githubClient.fetchStaleRepos(staleReposDays, staleLimit),
              config.skipBitbucket
                ? Promise.resolve([])
                : bitbucketClient.fetchStaleRepos(staleReposDays, staleLimit),
            ]);

            if (splashInterval) {
              clearInterval(splashInterval);
            }
            process.stdout.write('\r\x1b[K');

            const allRepos: StaleRepository[] = [...githubRepos, ...bitbucketRepos];

            // Sort by lastPush ascending (oldest first)
            allRepos.sort((a, b) => {
              const aTime = a.lastPush?.getTime() ?? 0;
              const bTime = b.lastPush?.getTime() ?? 0;
              return aTime - bTime;
            });

            // Apply limit
            const displayRepos = staleLimit ? allRepos.slice(0, staleLimit) : allRepos;

            if (displayRepos.length === 0) {
              consola.success('✅ All clear! No stale repositories found.');
              return;
            }

            if (clearScreen) {
              console.clear();
              showBanner({ version: `v${version}`, showTaglines: true });
            }

            const terminalWidth = process.stdout.columns || 120;
            const fixedWidths = { src: 5, archived: 10, fork: 7, lastPush: 13 };
            const totalFixed = Object.values(fixedWidths).reduce((a, b) => a + b, 0);
            const borders = 10;
            const nameWidth = Math.max(
              25,
              Math.floor((terminalWidth - totalFixed - borders) * 0.3)
            );
            const descWidth = Math.max(40, terminalWidth - totalFixed - nameWidth - borders);

            const actualTableWidth = totalFixed + nameWidth + descWidth + 6;
            const bannerWidth = actualTableWidth - 2;
            const limitApplied = staleLimit && allRepos.length > staleLimit;
            const titleText = limitApplied
              ? `Stale Repos (showing ${displayRepos.length} of ${allRepos.length}, no commits in ${staleReposDays}+ days)`
              : `Stale Repos (${displayRepos.length} total, no commits in ${staleReposDays}+ days)`;
            const currentTime = new Date().toLocaleTimeString();

            const centerPos = Math.floor(bannerWidth / 2);
            const centerStart = centerPos - Math.floor(titleText.length / 2);
            let line = ' ';
            const spacesToCenter = Math.max(1, centerStart - line.length);
            line += ' '.repeat(spacesToCenter) + titleText;
            const spacesToRight = Math.max(1, bannerWidth - line.length - currentTime.length - 1);
            line += ' '.repeat(spacesToRight) + currentTime + ' ';

            const styledLine =
              ' '.repeat(spacesToCenter + 1) +
              titleText +
              ' '.repeat(spacesToRight) +
              chalk.dim(currentTime) +
              ' ';

            console.log(chalk.cyan.bold(`╔${'═'.repeat(bannerWidth)}╗`));
            console.log(chalk.cyan.bold('║') + styledLine + chalk.cyan.bold('║'));
            console.log(chalk.cyan.bold(`╚${'═'.repeat(bannerWidth)}╝`));

            const table = new Table({
              head: [
                chalk.cyan.bold('Src'),
                chalk.cyan.bold('Repository'),
                chalk.cyan.bold('Description'),
                chalk.cyan.bold('Archived'),
                chalk.cyan.bold('Fork'),
                chalk.cyan.bold('Last Push'),
              ],
              style: { head: [], border: ['cyan'], compact: false },
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
                fixedWidths.src,
                nameWidth,
                descWidth,
                fixedWidths.archived,
                fixedWidths.fork,
                fixedWidths.lastPush,
              ],
              wordWrap: false,
            });

            for (const repo of displayRepos) {
              const src = repo.source === 'GitHub' ? 'GH' : 'BB';

              let name = repo.name;
              const maxNameLen = nameWidth - 3;
              if (name.length > maxNameLen) {
                name = `${name.substring(0, maxNameLen - 3)}...`;
              }
              const nameLink = chalk.cyan(hyperlink(name, repo.url));

              let desc = repo.description || '';
              const maxDescLen = descWidth - 3;
              if (desc.length > maxDescLen) {
                desc = `${desc.substring(0, maxDescLen - 3)}...`;
              }

              const archived = repo.isArchived ? chalk.yellow('Yes') : chalk.dim('No');
              const fork = repo.isFork ? chalk.yellow('Yes') : chalk.dim('No');
              const lastPush = repo.lastPush ? repo.lastPush.toISOString().split('T')[0] : 'N/A';

              table.push([src, nameLink, chalk.dim(desc), archived, fork, chalk.gray(lastPush)]);
            }

            console.log(table.toString());
            return;
          }

          // Standard PR fetch modes
          const [githubPRs, bitbucketPRs] = await Promise.all([
            githubClient.fetchPRs(
              mode as 'default' | 'approved-open' | 'approved-merged-since' | 'stale',
              dateStr,
              staleDays,
              staleLimit
            ),
            config.skipBitbucket
              ? Promise.resolve([])
              : bitbucketClient.fetchPRs(
                  mode as 'default' | 'approved-open' | 'approved-merged-since' | 'stale',
                  dateStr,
                  staleDays,
                  staleLimit
                ),
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

          // Sort: for stale mode, sort by created date ascending (oldest first)
          // For other modes, sort by source, then repository, then id
          if (mode === 'stale') {
            allPRs.sort((a, b) => {
              const aTime = a.created?.getTime() ?? 0;
              const bTime = b.created?.getTime() ?? 0;
              return aTime - bTime; // Oldest first
            });
          } else {
            allPRs.sort((a, b) => {
              if (a.source !== b.source) {
                return a.source.localeCompare(b.source);
              }
              if (a.repository !== b.repository) {
                return a.repository.localeCompare(b.repository);
              }
              return a.id - b.id;
            });
          }

          // Apply limit for stale mode
          const displayPRs = mode === 'stale' && staleLimit ? allPRs.slice(0, staleLimit) : allPRs;
          const limitApplied = mode === 'stale' && staleLimit && allPRs.length > staleLimit;

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
          const titleText = limitApplied
            ? `Stale PRs (showing ${displayPRs.length} of ${allPRs.length}, oldest first)`
            : mode === 'stale'
              ? `Stale PRs (${displayPRs.length} total, oldest first)`
              : `Pull Requests (${displayPRs.length} total)`;
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

          for (const pr of displayPRs) {
            const total = pr.assigneeCount > 0 ? pr.assigneeCount.toString() : '?';
            const myApproval = pr.iApproved ? ' ✅' : '';
            const approvalStr = `${pr.approvalCount}/${total}${myApproval}`;

            const src = pr.source === 'GitHub' ? 'GH' : 'BB';

            let title = pr.title;
            const maxTitleLen = titleWidth - 4;
            if (title.length > maxTitleLen) {
              title = `${title.substring(0, maxTitleLen - 3)}...`;
            }

            // Create clickable link using OSC 8 hyperlink escape sequences
            // This works in VS Code terminal, Windows Terminal, and other modern terminals
            const titleLink = chalk.cyan(hyperlink(title, pr.url));

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

        // Set up process signal handlers for graceful shutdown
        let shouldExit = false;
        const handleSignal = (signal: string) => {
          if (options.debug) {
            consola.debug(`Received ${signal}, shutting down gracefully...`);
          }
          logToFile(options.logFile, `Received ${signal} signal - exiting immediately`);
          consola.info('👋 Shutting down...');
          shouldExit = true;
          // Exit immediately instead of waiting for sleep to finish
          process.exit(0);
        };

        process.on('SIGINT', () => handleSignal('SIGINT'));
        process.on('SIGTERM', () => handleSignal('SIGTERM'));

        // Handle unhandled rejections and exceptions
        process.on('unhandledRejection', (reason, promise) => {
          const errorMsg = `Unhandled Rejection: ${String(reason)}`;
          consola.error('Unhandled Rejection at:', promise, 'reason:', reason);
          logToFile(options.logFile, `ERROR: ${errorMsg}`);
          if (!runOnce) {
            consola.warn('Continuing watch mode despite error...');
            logToFile(options.logFile, 'Continuing watch mode despite unhandled rejection');
          }
        });

        process.on('uncaughtException', (error) => {
          const errorMsg = `Uncaught Exception: ${error.message}\n${error.stack}`;
          consola.error('Uncaught Exception:', error);
          logToFile(options.logFile, `FATAL: ${errorMsg}`);
          if (!runOnce) {
            consola.warn('Attempting to continue watch mode...');
            logToFile(options.logFile, 'Attempting to continue watch mode after exception');
          } else {
            logToFile(options.logFile, 'Exiting due to uncaught exception in once mode');
            process.exit(1);
          }
        });

        if (runOnce) {
          await fetchAndDisplay(false);
        } else {
          let firstRun = true;
          let iterationCount = 0;

          while (!shouldExit) {
            iterationCount++;
            const nextRun = new Date();
            nextRun.setMinutes(nextRun.getMinutes() + config.watchInterval);

            if (options.debug) {
              consola.debug(
                `Starting iteration ${iterationCount} at ${new Date().toLocaleTimeString()}`
              );
            }
            logToFile(options.logFile, `Starting iteration ${iterationCount}`);

            try {
              await fetchAndDisplay(!firstRun, nextRun);
              firstRun = false;

              if (options.debug) {
                consola.debug(
                  `Iteration ${iterationCount} completed successfully. Next refresh at ${nextRun.toLocaleTimeString()}`
                );
              }
              logToFile(
                options.logFile,
                `Iteration ${iterationCount} completed successfully. Next: ${nextRun.toLocaleTimeString()}`
              );
            } catch (iterError) {
              const error = iterError as Error;
              const errorMsg = `${error.message}\n${error.stack || ''}`;
              consola.error(`Error in iteration ${iterationCount}:`, iterError);
              logToFile(options.logFile, `ERROR in iteration ${iterationCount}: ${errorMsg}`);
              consola.warn(
                `Will retry in ${config.watchInterval} minute(s). Press Ctrl+C to exit.`
              );
              logToFile(options.logFile, `Will retry in ${config.watchInterval} minute(s)`);

              // Show banner again after error so user sees something
              console.log('');
              showBanner({ version: `v${version}`, showTaglines: false });
            }

            // Only sleep if we're not exiting
            if (!shouldExit) {
              const sleepMs = config.watchInterval * 60 * 1000;
              const sleepStart = Date.now();

              if (options.debug) {
                const memUsage = process.memoryUsage();
                consola.debug(
                  `Sleeping for ${config.watchInterval} minute(s) until ${nextRun.toLocaleTimeString()}`
                );
                consola.debug(
                  `Memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
                );
                logToFile(
                  options.logFile,
                  `Memory usage: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, HeapUsed=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, External=${Math.round(memUsage.external / 1024 / 1024)}MB`
                );
              }

              // Heartbeat logging during sleep to detect unexpected termination
              const heartbeatInterval = options.debug ? 60000 : 300000; // 1min in debug, 5min otherwise
              let heartbeatCount = 0;
              const heartbeatTimer = setInterval(() => {
                heartbeatCount++;
                const elapsed = Math.round((Date.now() - sleepStart) / 1000);
                const remaining = Math.round((sleepMs - (Date.now() - sleepStart)) / 1000);
                logToFile(
                  options.logFile,
                  `Heartbeat ${heartbeatCount}: Alive at ${new Date().toISOString()} (elapsed: ${elapsed}s, remaining: ${remaining}s)`
                );

                if (options.debug) {
                  const memUsage = process.memoryUsage();
                  consola.debug(
                    `💓 Heartbeat ${heartbeatCount}: ${elapsed}s elapsed, ${remaining}s remaining, PID=${process.pid}`
                  );
                  logToFile(
                    options.logFile,
                    `Heartbeat ${heartbeatCount} memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, HeapUsed=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
                  );
                }
              }, heartbeatInterval);

              await new Promise((resolve) => setTimeout(resolve, sleepMs));
              clearInterval(heartbeatTimer);

              if (options.debug) {
                const actualSleep = Date.now() - sleepStart;
                consola.debug(
                  `Woke up after ${Math.round(actualSleep / 1000)}s (expected: ${Math.round(sleepMs / 1000)}s)`
                );
                logToFile(
                  options.logFile,
                  `Sleep completed: expected=${Math.round(sleepMs / 1000)}s, actual=${Math.round(actualSleep / 1000)}s`
                );
              }
            }
          }

          if (options.debug) {
            consola.debug(`Exited watch loop after ${iterationCount} iterations`);
          }
          logToFile(options.logFile, `Exited watch loop after ${iterationCount} iterations`);
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
    chalk.cyan('    $ prs --clear') +
      chalk.dim('                       # Clear screen before starting')
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
    chalk.cyan('    $ prs --stale-prs') + chalk.dim('                    # Find PRs open > 90 days')
  );
  lines.push(
    chalk.cyan('    $ prs --stale-days 30') + chalk.dim('                # Find PRs open > 30 days')
  );
  lines.push(
    chalk.cyan('    $ prs --stale-limit 10') +
      chalk.dim('               # Show 10 oldest stale PRs')
  );
  lines.push(
    chalk.cyan('    $ prs --stale-repos 180') +
      chalk.dim('              # Find repos with no commits in 180 days')
  );
  lines.push(
    chalk.cyan('    $ prs --watch 5') +
      chalk.dim('                     # Watch mode with 5min intervals')
  );
  lines.push(
    chalk.cyan('    $ prs --log-file prs.log') +
      chalk.dim('          # Log errors and events to file')
  );
  lines.push(
    chalk.cyan('    $ prs --debug --log-file prs.log') +
      chalk.dim('   # Verbose logging with file output')
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
