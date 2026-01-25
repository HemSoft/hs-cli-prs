#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import Table from 'cli-table3';
import { Command } from 'commander';
import { consola } from 'consola';
import terminalLink from 'terminal-link';
import { BitbucketClient } from './api/bitbucket.js';
import { GitHubClient, type PullRequest } from './api/github.js';
import { getConfigPath, loadConfig } from './lib/config-loader.js';
import { showBanner } from './lib/banner.js';
import { checkGitHubAuth } from './utils/auth-check.js';
import {
  checkGitHubCLI,
  getGitHubAccounts,
  runInteractiveSetup,
} from './utils/interactive-setup.js';
import { getRandomSplashText } from './utils/splash-texts.js';

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

// Add auth-check command
program
  .command('auth-check')
  .description('Check GitHub authentication status and organization access')
  .option('--org <organization>', 'Organization to check access for')
  .action(async (options: { org?: string }) => {
    const config = loadConfig();
    const org = options.org || config.github.org;

    consola.info(`Checking GitHub authentication for organization: ${org}\n`);
    const isValid = await checkGitHubAuth(org);

    process.exit(isValid ? 0 : 1);
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

        const configPath = getConfigPath();
        const hasConfig = existsSync(configPath);

        if (!hasConfig) {
          const hasGH = await checkGitHubCLI();
          if (!hasGH) {
            consola.error('❌ GitHub CLI not found!');
            console.log('');
            consola.info('Please install GitHub CLI:');
            consola.info('  Windows:  winget install --id GitHub.cli');
            consola.info('  macOS:    brew install gh');
            consola.info('  Linux:    https://github.com/cli/cli#installation');
            console.log('');
            consola.info('After installing, run: prs init');
            process.exit(1);
          }

          const accounts = await getGitHubAccounts();
          if (accounts.length === 0) {
            consola.error('❌ No authenticated GitHub accounts found!');
            console.log('');
            consola.info('Please authenticate with GitHub first:');
            consola.info('  gh auth login');
            console.log('');
            consola.info('Then run: prs init');
            process.exit(1);
          }

          if (accounts.length > 1) {
            consola.warn(`Found ${accounts.length} GitHub accounts: ${accounts.join(', ')}`);
            console.log('');
            consola.info('Please run setup to configure which accounts to use:');
            consola.info('  prs init');
            process.exit(1);
          }

          consola.info(
            `✨ Auto-configuring for GitHub account: ${accounts[0]} (org: ${accounts[0]})`
          );
          consola.info("💡 Run 'prs init' to customize configuration or add more accounts.");
          console.log('');
        }

        const fetchAndDisplay = async (clearScreen = true) => {
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
          }

          const terminalWidth = process.stdout.columns || 120;

          const fixedWidths = {
            approved: 11,
            src: 5,
            number: 6,
            author: 16,
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
          const padding = Math.max(0, Math.floor((bannerWidth - titleText.length) / 2));

          console.log(chalk.cyan.bold(`╔${'═'.repeat(bannerWidth)}╗`));
          console.log(
            chalk.cyan.bold(
              `║${' '.repeat(padding)}${titleText}${' '.repeat(bannerWidth - padding - titleText.length)}║`
            )
          );
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
            const titleLink = terminalLink(title, pr.url, { fallback: false });

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
          consola.info(`Running in watch mode (refresh every ${config.watchInterval} minutes)`);
          consola.info('Press Ctrl+C to exit\n');

          while (true) {
            await fetchAndDisplay(true);
            const nextRun = new Date();
            nextRun.setMinutes(nextRun.getMinutes() + config.watchInterval);
            consola.info(
              `\nNext refresh at ${nextRun.toLocaleTimeString()}. Waiting ${config.watchInterval} minutes...`
            );
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
  lines.push('');
  return lines.join('\n');
});

program.parse();
