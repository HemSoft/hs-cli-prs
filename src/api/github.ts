import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { consola } from 'consola';
import type { GitHubConfig } from '../types/config.js';
import {
  type GitHubPullRequest,
  GitHubPullRequestSchema,
  type GitHubSearchResult,
} from '../types/github.js';

const execAsync = promisify(exec);

export interface PullRequest {
  source: 'GitHub' | 'Bitbucket';
  repository: string;
  id: number;
  title: string;
  author: string;
  url: string;
  state: string;
  approvalCount: number;
  assigneeCount: number;
  iApproved: boolean;
  created: Date | null;
  date: string | null;
}

/**
 * GitHub API client using gh CLI
 */
export class GitHubClient {
  constructor(private config: GitHubConfig) {}

  /**
   * Check if gh CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('gh --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of all authenticated GitHub accounts
   */
  async getAuthenticatedAccounts(): Promise<string[]> {
    try {
      const { stdout, stderr } = await execAsync('gh auth status');
      // gh auth status outputs to stderr
      consola.debug('gh auth status stderr:', stderr);
      consola.debug('gh auth status stdout:', stdout);

      // Try both stderr and stdout
      const text = stderr || stdout;

      const accounts: string[] = [];
      // Match various formats: with/without checkmark, with/without ANSI codes
      const lines = text.split('\n');
      for (const line of lines) {
        // Look for "Logged in to github.com account <username>"
        const match = line.match(/Logged in to github\.com account (\S+)/i);
        if (match?.[1]) {
          accounts.push(match[1]);
        }
      }

      consola.debug('Found accounts:', accounts);
      return accounts;
    } catch (error) {
      consola.debug('Error getting authenticated accounts:', error);
      return [];
    }
  }

  /**
   * Check if gh CLI is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await execAsync('gh auth status');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current GitHub user login
   */
  async getCurrentUser(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('gh api user --jq .login');
      return stdout.trim();
    } catch (error: unknown) {
      const errText =
        error instanceof Error
          ? (error as Error & { stderr?: string }).stderr || error.message
          : '';
      // Check if it's an auth error
      if (errText.includes('authentication') || errText.includes('401')) {
        consola.debug('GitHub authentication error detected:', errText);
      }
      consola.debug('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Switch to a specific GitHub account
   */
  async switchAccount(account: string): Promise<boolean> {
    try {
      await execAsync(`gh auth switch --user "${account}"`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify access to an organization for a specific account
   */
  async canAccessOrgForAccount(
    org: string,
    account: string
  ): Promise<{ accessible: boolean; error?: string }> {
    try {
      // Try to list repos in the org (with limit 1 to be fast)
      await execAsync(`gh repo list "${org}" --limit 1 --json name`);
      return { accessible: true };
    } catch (error: unknown) {
      const errText =
        error instanceof Error
          ? (error as Error & { stderr?: string }).stderr || error.message
          : '';

      // Parse error message for helpful feedback
      if (errText.includes('404') || errText.includes('Not Found')) {
        return {
          accessible: false,
          error: `Organization '${org}' not found or account '${account}' doesn't have access to it.`,
        };
      }

      if (errText.includes('403') || errText.includes('Forbidden')) {
        return {
          accessible: false,
          error: `Access denied to organization '${org}' for account '${account}'.`,
        };
      }

      if (errText.includes('401') || errText.includes('authentication')) {
        return {
          accessible: false,
          error: `Authentication failed for account '${account}'. Token may have expired.`,
        };
      }

      return {
        accessible: false,
        error: `Failed to access organization '${org}': ${errText.trim()}`,
      };
    }
  }

  /**
   * Verify access to the configured organization
   */
  async canAccessOrg(): Promise<{ accessible: boolean; error?: string }> {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      return { accessible: false, error: 'Could not get current user' };
    }
    return this.canAccessOrgForAccount(this.config.org, currentUser);
  }

  /**
   * Get PR details including reviews and assignees
   */
  async getPRDetails(prUrl: string): Promise<GitHubPullRequest | null> {
    try {
      const { stdout } = await execAsync(
        `gh pr view "${prUrl}" --json number,title,url,state,mergedAt,createdAt,author,reviews,assignees`
      );

      if (stdout.trim()) {
        const data = JSON.parse(stdout);
        return GitHubPullRequestSchema.parse(data);
      }
      return null;
    } catch (error) {
      consola.debug(`Failed to get PR details for ${prUrl}:`, error);
      return null;
    }
  }

  /**
   * Search for PRs using gh CLI
   */
  async searchPRs(args: string[]): Promise<GitHubSearchResult[]> {
    try {
      const argsStr = args.join(' ');
      const { stdout } = await execAsync(
        `gh search prs ${argsStr} --json number,title,url,repository --limit 100`
      );

      if (!stdout.trim()) {
        return [];
      }

      const data: unknown = JSON.parse(stdout);
      return Array.isArray(data) ? (data as GitHubSearchResult[]) : [];
    } catch (error) {
      consola.debug('Failed to search PRs:', error);
      return [];
    }
  }

  /**
   * Fetch all PRs based on mode
   */
  async fetchPRs(
    mode: 'default' | 'approved-open' | 'approved-merged-since',
    dateStr?: string
  ): Promise<PullRequest[]> {
    // Check if gh CLI is installed
    if (!(await this.isAvailable())) {
      consola.warn('⚠️  GitHub CLI (gh) is not installed or not in PATH.');
      consola.info('   Install from: https://cli.github.com/');
      return [];
    }

    // Check if gh is authenticated
    if (!(await this.isAuthenticated())) {
      consola.error('❌ GitHub CLI is not authenticated.');
      consola.info('   Run: gh auth login');
      consola.info('   Then select the account that has access to your organization.');
      return [];
    }

    // Get all authenticated accounts
    const allAccounts = await this.getAuthenticatedAccounts();
    if (allAccounts.length === 0) {
      consola.error('❌ No authenticated GitHub accounts found.');
      return [];
    }

    consola.debug(
      `Found ${allAccounts.length} authenticated account(s): ${allAccounts.join(', ')}`
    );

    // Determine which accounts to check
    const accountsToCheck = this.config.accounts || [
      { account: allAccounts[0], org: this.config.org },
    ];

    const allPrs: PullRequest[] = [];

    // Fetch PRs for each account/org combination
    for (const { account, org } of accountsToCheck) {
      // Skip if account or org is undefined
      if (!account || !org) {
        consola.warn('⚠️  Invalid account/org configuration. Skipping.');
        continue;
      }

      if (!allAccounts.includes(account)) {
        consola.warn(`⚠️  Account '${account}' not found in authenticated accounts. Skipping.`);
        continue;
      }

      consola.debug(`Checking account '${account}' for org '${org}'...`);

      // Switch to this account
      await this.switchAccount(account);

      // Get current user to verify switch
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        consola.warn(`⚠️  Could not verify user for account '${account}'. Skipping.`);
        continue;
      }

      if (currentUser !== account) {
        consola.warn(
          `⚠️  Account mismatch: expected '${account}', got '${currentUser}'. Skipping.`
        );
        continue;
      }

      // Verify access to the organization
      const orgAccess = await this.canAccessOrgForAccount(org, account);
      if (!orgAccess.accessible) {
        consola.warn(`⚠️  ${orgAccess.error} (account: ${account})`);
        continue;
      }

      consola.debug(`✓ Authenticated as ${currentUser} with access to ${org}`);

      // Fetch PRs for this account/org
      const prs = await this.fetchPRsForAccount(mode, org, currentUser, dateStr);
      allPrs.push(...prs);
    }

    return allPrs;
  }

  /**
   * Fetch PRs for a specific account and org
   */
  private async fetchPRsForAccount(
    mode: 'default' | 'approved-open' | 'approved-merged-since',
    org: string,
    currentUser: string,
    dateStr?: string
  ): Promise<PullRequest[]> {
    const allPrs: GitHubPullRequest[] = [];
    const seenUrls = new Set<string>();

    let searchCommands: string[][] = [];

    if (mode === 'approved-open') {
      searchCommands = [['--reviewed-by=@me', '--state=open', `--owner=${org}`]];
    } else if (mode === 'approved-merged-since' && dateStr) {
      searchCommands = [
        ['--reviewed-by=@me', '--state=merged', `--owner=${org}`, `--merged=>=${dateStr}`],
      ];
    } else {
      // Default mode: all PRs I'm involved with
      searchCommands = [
        ['--author=@me', '--state=open', `--owner=${org}`],
        ['--assignee=@me', '--state=open', `--owner=${org}`],
        ['--reviewed-by=@me', '--state=open', `--owner=${org}`],
        ['--review-requested=@me', '--state=open', `--owner=${org}`],
      ];
    }

    for (const cmdArgs of searchCommands) {
      const searchResults = await this.searchPRs(cmdArgs);

      for (const result of searchResults) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          const prDetails = await this.getPRDetails(result.url);
          if (prDetails) {
            allPrs.push(prDetails);
          }
        }
      }
    }

    // Transform to unified PR format
    return allPrs.map((pr) => {
      const repoName = pr.repository?.name || pr.url.split('/').slice(-3, -2)[0] || 'unknown';

      // Count unique approvals and check if current user approved
      let approvalCount = 0;
      let iApproved = false;

      if (pr.reviews) {
        const reviewerGroups = new Map<string, typeof pr.reviews>();
        for (const review of pr.reviews) {
          const login = review.author.login;
          if (!reviewerGroups.has(login)) {
            reviewerGroups.set(login, []);
          }
          reviewerGroups.get(login)?.push(review);
        }

        for (const [login, reviews] of reviewerGroups) {
          const latestReview = reviews.sort((a, b) => {
            const aTime = a.submittedAt || '';
            const bTime = b.submittedAt || '';
            return bTime.localeCompare(aTime);
          })[0];

          if (latestReview?.state === 'APPROVED') {
            approvalCount++;
            if (login === currentUser) {
              iApproved = true;
            }
          }
        }
      }

      const assigneeCount = pr.assignees?.length || 0;

      return {
        source: 'GitHub' as const,
        repository: repoName,
        id: pr.number,
        title: pr.title,
        author: pr.author.login,
        url: pr.url,
        state: pr.state,
        approvalCount,
        assigneeCount,
        iApproved,
        created: pr.createdAt ? new Date(pr.createdAt) : null,
        date: pr.mergedAt || null,
      };
    });
  }
}
