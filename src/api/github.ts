import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { consola } from 'consola';
import type { GitHubConfig } from '../types/config.js';
import { checkAndWarnRateLimit } from '../utils/token-validator.js';

// Create Octokit with retry and throttling plugins
const OctokitWithPlugins = Octokit.plugin(retry, throttling);

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

export interface StaleRepository {
  source: 'GitHub' | 'Bitbucket';
  name: string;
  fullName: string;
  url: string;
  lastPush: Date | null;
  description: string | null;
  isArchived: boolean;
  isFork: boolean;
}

/**
 * GitHub API client using Octokit
 * Supports multiple accounts with token-based authentication
 */
export class GitHubClient {
  constructor(private config: GitHubConfig) {}

  /**
   * Get Octokit instance for a specific account with retry and throttling
   */
  private getOctokit(tokenEnvVar: string): Octokit | null {
    const token = process.env[tokenEnvVar];

    if (!token) {
      consola.warn(`⚠️  Environment variable '${tokenEnvVar}' not set`);
      return null;
    }

    return new OctokitWithPlugins({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          consola.warn(`Rate limit hit for ${options.method} ${options.url}`);
          if (retryCount < 3) {
            consola.info(`Retrying after ${retryAfter} seconds (attempt ${retryCount + 1}/3)`);
            return true;
          }
          return false;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          consola.warn(`Secondary rate limit hit for ${options.method} ${options.url}`);
          if (retryCount < 2) {
            consola.info(`Retrying after ${retryAfter} seconds (attempt ${retryCount + 1}/2)`);
            return true;
          }
          return false;
        },
      },
      retry: {
        doNotRetry: ['429'],
        retries: 3,
      },
    });
  }

  /**
   * Fetch all PRs based on mode for all configured accounts
   */
  async fetchPRs(
    mode: 'default' | 'approved-open' | 'approved-merged-since' | 'stale',
    dateStr?: string,
    staleDays = 90,
    staleLimit?: number
  ): Promise<PullRequest[]> {
    const allPrs: PullRequest[] = [];

    // Process each configured GitHub account
    for (const account of this.config.accounts) {
      const { username, org, tokenEnvVar } = account;

      // Early termination if we have enough stale PRs
      if (mode === 'stale' && staleLimit && allPrs.length >= staleLimit) {
        consola.debug(`Reached stale limit (${staleLimit}), skipping remaining accounts`);
        break;
      }

      consola.debug(`Checking GitHub account '${username}' for org '${org}'...`);

      // Get Octokit instance for this account
      const octokit = this.getOctokit(tokenEnvVar);
      if (!octokit) {
        consola.warn(`⚠️  Skipping account '${username}' - token not available`);
        continue;
      }

      // Validate token and check rate limit
      try {
        const token = process.env[tokenEnvVar]!;
        await checkAndWarnRateLimit(token);

        // Fetch PRs for this account
        const remainingLimit =
          mode === 'stale' && staleLimit ? staleLimit - allPrs.length : undefined;
        const prs = await this.fetchPRsForAccount(
          octokit,
          mode,
          org,
          username,
          dateStr,
          staleDays,
          remainingLimit
        );
        allPrs.push(...prs);

        consola.debug(`✓ Found ${prs.length} PRs for ${username} in ${org}`);
      } catch (error) {
        consola.warn(
          `⚠️  Error fetching PRs for ${username}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    return allPrs;
  }

  /**
   * Fetch PRs for a specific account and org using Octokit
   */
  private async fetchPRsForAccount(
    octokit: Octokit,
    mode: 'default' | 'approved-open' | 'approved-merged-since' | 'stale',
    org: string,
    username: string,
    dateStr?: string,
    staleDays = 90,
    staleLimit?: number
  ): Promise<PullRequest[]> {
    const seenUrls = new Set<string>();
    const allPrs: PullRequest[] = [];

    let queries: string[] = [];

    if (mode === 'stale') {
      // Calculate date threshold for stale PRs
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - staleDays);
      const staleDateStr = staleDate.toISOString().split('T')[0];
      // Find all open PRs created before the stale threshold
      queries = [`is:pr is:open org:${org} created:<${staleDateStr}`];
    } else if (mode === 'approved-open') {
      queries = [`is:pr reviewed-by:${username} is:open org:${org}`];
    } else if (mode === 'approved-merged-since' && dateStr) {
      queries = [`is:pr reviewed-by:${username} is:merged org:${org} merged:>=${dateStr}`];
    } else {
      // Default mode: all PRs I'm involved with
      queries = [
        `is:pr author:${username} is:open org:${org}`,
        `is:pr assignee:${username} is:open org:${org}`,
        `is:pr reviewed-by:${username} is:open org:${org}`,
        `is:pr review-requested:${username} is:open org:${org}`,
      ];
    }

    // Execute each search query
    for (const query of queries) {
      // Early termination if we have enough stale PRs
      if (mode === 'stale' && staleLimit && allPrs.length >= staleLimit) {
        break;
      }

      try {
        // For stale mode, sort by created date ascending (oldest first), and limit per_page
        const perPage = mode === 'stale' && staleLimit ? Math.min(100, staleLimit) : 100;
        const searchResults = await octokit.search.issuesAndPullRequests({
          q: query,
          per_page: perPage,
          sort: mode === 'stale' ? 'created' : 'updated',
          order: mode === 'stale' ? 'asc' : 'desc',
        });

        for (const item of searchResults.data.items) {
          // Early termination if we have enough stale PRs
          if (mode === 'stale' && staleLimit && allPrs.length >= staleLimit) {
            break;
          }

          if (seenUrls.has(item.html_url)) {
            continue;
          }
          seenUrls.add(item.html_url);

          // Parse owner/repo from URL (https://github.com/owner/repo/pull/123)
          const urlMatch = item.html_url.match(/github\.com\/([^/]+)\/([^/]+)\/pull/);
          if (!urlMatch || !urlMatch[1] || !urlMatch[2]) {
            consola.debug(`Invalid PR URL format: ${item.html_url}`);
            continue;
          }

          const repo: string = urlMatch[2];

          // For stale mode, use search results directly (much faster - no extra API calls)
          if (mode === 'stale') {
            allPrs.push({
              source: 'GitHub' as const,
              repository: repo,
              id: item.number,
              title: item.title,
              author: item.user?.login || 'unknown',
              url: item.html_url,
              state: item.state,
              approvalCount: 0, // Not fetched for stale mode (too slow)
              assigneeCount: 0, // Not fetched for stale mode (too slow)
              iApproved: false, // Not fetched for stale mode (too slow)
              created: item.created_at ? new Date(item.created_at) : null,
              date: null,
            });
          } else {
            // For other modes, get full PR details including reviews
            const owner: string = urlMatch[1];
            const prNumber = item.number;

            try {
              const pr = await this.getPRDetails(octokit, owner, repo, prNumber, username);
              if (pr) {
                allPrs.push(pr);
              }
            } catch (error) {
              consola.debug(`Failed to get details for PR #${prNumber}:`, error);
            }
          }
        }
      } catch (error) {
        consola.debug(`Search query failed: ${query}`, error);
      }
    }

    return allPrs;
  }

  /**
   * Fetch stale repositories (no commits in X days) for all configured accounts
   * Uses GitHub search API with pushed:<date for efficient single-query lookup
   */
  async fetchStaleRepos(staleDays: number, limit = 50): Promise<StaleRepository[]> {
    const allRepos: StaleRepository[] = [];
    const seenFullNames = new Set<string>();

    // Calculate date threshold
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);
    const staleDateStr = staleDate.toISOString().split('T')[0];

    for (const account of this.config.accounts) {
      const { username, org, tokenEnvVar } = account;

      if (allRepos.length >= limit) {
        consola.debug(`Reached limit (${limit}), skipping remaining accounts`);
        break;
      }

      consola.debug(`Checking stale repos for org '${org}'...`);

      const octokit = this.getOctokit(tokenEnvVar);
      if (!octokit) {
        consola.warn(`⚠️  Skipping account '${username}' - token not available`);
        continue;
      }

      try {
        // Search for repos in org that haven't been pushed to since stale date
        // Exclude archived repos by default
        // Sort by pushed ascending (oldest first)
        const remainingLimit = limit - allRepos.length;
        const searchResults = await octokit.search.repos({
          q: `org:${org} pushed:<${staleDateStr} archived:false`,
          per_page: Math.min(100, remainingLimit),
          sort: 'updated',
          order: 'asc',
        });

        for (const repo of searchResults.data.items) {
          if (allRepos.length >= limit) break;
          if (seenFullNames.has(repo.full_name)) continue;
          seenFullNames.add(repo.full_name);

          allRepos.push({
            source: 'GitHub',
            name: repo.name,
            fullName: repo.full_name,
            url: repo.html_url,
            lastPush: repo.pushed_at ? new Date(repo.pushed_at) : null,
            description: repo.description,
            isArchived: repo.archived || false,
            isFork: repo.fork || false,
          });
        }

        consola.debug(`✓ Found ${searchResults.data.items.length} stale repos in ${org}`);
      } catch (error) {
        consola.warn(
          `⚠️  Error fetching stale repos for ${org}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    // Sort by lastPush ascending (oldest first)
    allRepos.sort((a, b) => {
      const aTime = a.lastPush?.getTime() ?? 0;
      const bTime = b.lastPush?.getTime() ?? 0;
      return aTime - bTime;
    });

    return allRepos.slice(0, limit);
  }

  /**
   * Get PR details including reviews and assignees
   */
  private async getPRDetails(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    currentUser: string
  ): Promise<PullRequest | null> {
    try {
      // Fetch PR data
      const prData = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Fetch reviews
      const reviewsData = await octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      });

      const pr = prData.data;
      const reviews = reviewsData.data;

      // Count unique approvals and check if current user approved
      let approvalCount = 0;
      let iApproved = false;

      if (reviews.length > 0) {
        const reviewerGroups = new Map<string, typeof reviews>();

        for (const review of reviews) {
          const login = review.user?.login;
          if (!login) continue;

          if (!reviewerGroups.has(login)) {
            reviewerGroups.set(login, []);
          }
          reviewerGroups.get(login)?.push(review);
        }

        for (const [login, userReviews] of reviewerGroups) {
          // Get latest review from this user
          const latestReview = userReviews.sort((a, b) => {
            const aTime = a.submitted_at || '';
            const bTime = b.submitted_at || '';
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
        repository: repo,
        id: pr.number,
        title: pr.title,
        author: pr.user?.login || 'unknown',
        url: pr.html_url,
        state: pr.state,
        approvalCount,
        assigneeCount,
        iApproved,
        created: pr.created_at ? new Date(pr.created_at) : null,
        date: pr.merged_at || null,
      };
    } catch (error) {
      consola.debug(`Failed to get PR details for ${owner}/${repo}#${prNumber}:`, error);
      return null;
    }
  }
}
