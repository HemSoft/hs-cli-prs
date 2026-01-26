import { Octokit } from '@octokit/rest';
import { consola } from 'consola';
import type { GitHubConfig } from '../types/config.js';
import { checkAndWarnRateLimit } from '../utils/token-validator.js';

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
 * GitHub API client using Octokit
 * Supports multiple accounts with token-based authentication
 */
export class GitHubClient {
  constructor(private config: GitHubConfig) {}

  /**
   * Get Octokit instance for a specific account
   */
  private getOctokit(tokenEnvVar: string): Octokit | null {
    const token = process.env[tokenEnvVar];

    if (!token) {
      consola.warn(`⚠️  Environment variable '${tokenEnvVar}' not set`);
      return null;
    }

    return new Octokit({ auth: token });
  }

  /**
   * Fetch all PRs based on mode for all configured accounts
   */
  async fetchPRs(
    mode: 'default' | 'approved-open' | 'approved-merged-since',
    dateStr?: string
  ): Promise<PullRequest[]> {
    const allPrs: PullRequest[] = [];

    // Process each configured GitHub account
    for (const account of this.config.accounts) {
      const { username, org, tokenEnvVar } = account;

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
        const prs = await this.fetchPRsForAccount(octokit, mode, org, username, dateStr);
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
    mode: 'default' | 'approved-open' | 'approved-merged-since',
    org: string,
    username: string,
    dateStr?: string
  ): Promise<PullRequest[]> {
    const seenUrls = new Set<string>();
    const allPrs: PullRequest[] = [];

    let queries: string[] = [];

    if (mode === 'approved-open') {
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
      try {
        const searchResults = await octokit.search.issuesAndPullRequests({
          q: query,
          per_page: 100,
          sort: 'updated',
          order: 'desc',
        });

        for (const item of searchResults.data.items) {
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

          const owner: string = urlMatch[1];
          const repo: string = urlMatch[2];
          const prNumber = item.number;

          // Get full PR details including reviews and assignees
          try {
            const pr = await this.getPRDetails(octokit, owner, repo, prNumber, username);
            if (pr) {
              allPrs.push(pr);
            }
          } catch (error) {
            consola.debug(`Failed to get details for PR #${prNumber}:`, error);
          }
        }
      } catch (error) {
        consola.debug(`Search query failed: ${query}`, error);
      }
    }

    return allPrs;
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
