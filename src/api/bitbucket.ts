import { consola } from 'consola';
import {
  type BitbucketPagedResponse,
  BitbucketPagedResponseSchema,
  type BitbucketPullRequest,
  BitbucketPullRequestSchema,
  type BitbucketRepository,
  BitbucketRepositorySchema,
} from '../types/bitbucket.js';
import type { BitbucketConfig } from '../types/config.js';
import type { PullRequest } from './github.js';

/**
 * Bitbucket API client
 */
export class BitbucketClient {
  private baseUrl = 'https://api.bitbucket.org/2.0';
  private userCache = new Map<string, { uuid: string }>();

  constructor(private config: BitbucketConfig) {}

  /**
   * Get authorization header for a specific workspace
   */
  private getAuthHeader(username: string, token: string): Record<string, string> {
    const credentials = `${username}:${token}`;
    const base64 = Buffer.from(credentials).toString('base64');

    return {
      Authorization: `Basic ${base64}`,
    };
  }

  /**
   * Make an API request with retry logic for rate limits
   */
  private async apiRequest<T>(
    url: string,
    authHeaders: Record<string, string>,
    maxAttempts = 5
  ): Promise<T> {
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        const response = await fetch(url, {
          headers: authHeaders,
        });

        if (response.status === 429) {
          const retryAfter = Number.parseInt(response.headers.get('Retry-After') || '60', 10);
          const jitter = Math.floor(Math.random() * 5) + 1;
          const waitTime = retryAfter + jitter;

          if (attempt < maxAttempts) {
            consola.debug(
              `Rate limited. Waiting ${waitTime}s before retry ${attempt}/${maxAttempts}`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
            continue;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  /**
   * Get paged results from Bitbucket API
   */
  private async getPagedResults<T>(url: string, authHeaders: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | undefined = url;

    while (nextUrl) {
      const response = await this.apiRequest<BitbucketPagedResponse>(nextUrl, authHeaders);
      const parsed = BitbucketPagedResponseSchema.parse(response);

      if (parsed.values) {
        results.push(...(parsed.values as T[]));
      }

      nextUrl = parsed.next;
    }

    return results;
  }

  /**
   * Get current Bitbucket user for a specific workspace
   */
  private async getCurrentUser(username: string, token: string): Promise<{ uuid: string } | null> {
    // Check cache first
    if (this.userCache.has(username)) {
      return this.userCache.get(username)!;
    }

    try {
      const authHeaders = this.getAuthHeader(username, token);
      const user = await this.apiRequest<{ uuid: string }>(`${this.baseUrl}/user`, authHeaders);

      // Cache the user
      this.userCache.set(username, user);
      return user;
    } catch (error) {
      consola.debug(`Failed to get current Bitbucket user for ${username}:`, error);
      return null;
    }
  }

  /**
   * Fetch repositories updated in the last 90 days for a workspace
   */
  private async getRecentRepositories(
    workspace: string,
    authHeaders: Record<string, string>
  ): Promise<BitbucketRepository[]> {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 90);
    const minDateStr = minDate.toISOString().split('T')[0];

    const url = `${this.baseUrl}/repositories/${workspace}?pagelen=100&sort=-updated_on&q=updated_on>=${minDateStr}`;

    try {
      const repos = await this.getPagedResults<BitbucketRepository>(url, authHeaders);
      return repos.map((repo) => BitbucketRepositorySchema.parse(repo));
    } catch (error) {
      consola.error(`Failed to fetch Bitbucket repositories for ${workspace}:`, error);
      return [];
    }
  }

  /**
   * Fetch PRs for a specific repository
   */
  private async getRepositoryPRs(
    repoFullName: string,
    state: 'OPEN' | 'MERGED',
    authHeaders: Record<string, string>,
    dateStr?: string
  ): Promise<BitbucketPullRequest[]> {
    let query = `state="${state}"`;
    if (state === 'MERGED' && dateStr) {
      query += ` AND updated_on >= ${dateStr}`;
    }

    const fields =
      'values.id,values.title,values.links.html.href,values.state,values.author.display_name,values.updated_on,values.merged_on,values.created_on,values.participants.user.uuid,values.participants.approved,values.reviewers.uuid,next';

    const url = `${this.baseUrl}/repositories/${repoFullName}/pullrequests?q=${encodeURIComponent(query)}&sort=-updated_on&pagelen=50&fields=${fields}`;

    try {
      const prs = await this.getPagedResults<BitbucketPullRequest>(url, authHeaders);
      return prs.map((pr) => BitbucketPullRequestSchema.parse(pr));
    } catch (error) {
      consola.debug(`Failed to fetch PRs for ${repoFullName}:`, error);
      return [];
    }
  }

  /**
   * Fetch all PRs based on mode for all configured workspaces
   */
  async fetchPRs(
    mode: 'default' | 'approved-open' | 'approved-merged-since',
    dateStr?: string
  ): Promise<PullRequest[]> {
    const allPrs: PullRequest[] = [];

    // Process each configured Bitbucket workspace
    for (const workspace of this.config.workspaces) {
      const { workspace: workspaceName, username, tokenEnvVar } = workspace;
      const token = process.env[tokenEnvVar];

      if (!token) {
        consola.warn(
          `⚠️  Skipping workspace '${workspaceName}' - token not available in ${tokenEnvVar}`
        );
        continue;
      }

      consola.debug(`Checking Bitbucket workspace '${workspaceName}'...`);

      try {
        const prs = await this.fetchPRsForWorkspace(workspaceName, username, token, mode, dateStr);
        allPrs.push(...prs);

        consola.debug(`✓ Found ${prs.length} PRs in workspace ${workspaceName}`);
      } catch (error) {
        consola.warn(
          `⚠️  Error fetching PRs for workspace ${workspaceName}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    return allPrs;
  }

  /**
   * Fetch PRs for a specific workspace
   */
  private async fetchPRsForWorkspace(
    workspaceName: string,
    username: string,
    token: string,
    mode: 'default' | 'approved-open' | 'approved-merged-since',
    dateStr?: string
  ): Promise<PullRequest[]> {
    const authHeaders = this.getAuthHeader(username, token);

    const currentUser = await this.getCurrentUser(username, token);
    if (!currentUser) {
      return [];
    }

    const repos = await this.getRecentRepositories(workspaceName, authHeaders);
    if (repos.length === 0) {
      return [];
    }

    const apiState: 'OPEN' | 'MERGED' = mode === 'approved-merged-since' ? 'MERGED' : 'OPEN';
    const results: PullRequest[] = [];

    for (const repo of repos) {
      const prs = await this.getRepositoryPRs(repo.full_name, apiState, authHeaders, dateStr);

      for (const pr of prs) {
        let include = false;
        const meAsParticipant = pr.participants?.find((p) => p.user.uuid === currentUser.uuid);
        const meAsReviewer = pr.reviewers?.find((r) => r.uuid === currentUser.uuid);

        if (mode === 'default') {
          if (meAsReviewer) {
            include = true;
          }
        } else if (mode === 'approved-open' || mode === 'approved-merged-since') {
          if (meAsParticipant?.approved) {
            include = true;
          }
        }

        if (include) {
          // Count approvals
          let approvalCount = 0;
          let iApproved = false;

          if (pr.participants) {
            approvalCount = pr.participants.filter((p) => p.approved).length;
            if (meAsParticipant?.approved) {
              iApproved = true;
            }
          }

          const reviewerCount = pr.reviewers?.length || 0;

          results.push({
            source: 'Bitbucket',
            repository: repo.name,
            id: pr.id,
            title: pr.title,
            author: pr.author.display_name,
            url: pr.links.html.href,
            state: pr.state,
            approvalCount,
            assigneeCount: reviewerCount,
            iApproved,
            created: pr.created_on ? new Date(pr.created_on) : null,
            date: pr.merged_on || pr.updated_on || null,
          });
        }
      }
    }

    return results;
  }
}
