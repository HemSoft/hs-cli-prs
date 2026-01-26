import { Octokit } from '@octokit/rest';
import { consola } from 'consola';

/**
 * Required GitHub scopes for PR monitoring
 */
export const REQUIRED_GITHUB_SCOPES = ['repo', 'read:org'];

/**
 * GitHub token validation result
 */
export interface GitHubTokenValidation {
  valid: boolean;
  username?: string;
  scopes?: string[];
  missingScopes?: string[];
  error?: string;
}

/**
 * Bitbucket token validation result
 */
export interface BitbucketTokenValidation {
  valid: boolean;
  username?: string;
  displayName?: string;
  error?: string;
}

/**
 * Validate a GitHub Personal Access Token
 * Checks authentication and required scopes
 */
export async function validateGitHubToken(token: string): Promise<GitHubTokenValidation> {
  try {
    const octokit = new Octokit({ auth: token });

    // Get user info and check scopes
    const response = await octokit.request('GET /user');
    const username = response.data.login;

    // Parse scopes from response headers
    const scopeHeader = response.headers['x-oauth-scopes'];
    const scopes = scopeHeader ? scopeHeader.split(',').map((s) => s.trim()) : [];

    // Check for required scopes
    const missingScopes = REQUIRED_GITHUB_SCOPES.filter((required) => !scopes.includes(required));

    if (missingScopes.length > 0) {
      return {
        valid: false,
        username,
        scopes,
        missingScopes,
        error: `Missing required scopes: ${missingScopes.join(', ')}`,
      };
    }

    return {
      valid: true,
      username,
      scopes,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      if (error.status === 401) {
        return {
          valid: false,
          error: 'Invalid token - authentication failed',
        };
      }
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate a Bitbucket App Password
 * Checks authentication and retrieves user info
 */
export async function validateBitbucketToken(
  _workspace: string,
  username: string,
  token: string
): Promise<BitbucketTokenValidation> {
  try {
    // Bitbucket uses Basic Auth with username:token
    const auth = Buffer.from(`${username}:${token}`).toString('base64');

    const response = await fetch('https://api.bitbucket.org/2.0/user', {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          valid: false,
          error: 'Invalid credentials - authentication failed',
        };
      }
      return {
        valid: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as {
      username?: string;
      display_name?: string;
    };

    const result: BitbucketTokenValidation = { valid: true };
    if (data.username) {
      result.username = data.username;
    }
    if (data.display_name) {
      result.displayName = data.display_name;
    }

    return result;
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check rate limit status for GitHub token
 * Returns remaining requests and reset time
 */
export async function checkGitHubRateLimit(token: string): Promise<{
  remaining: number;
  reset: Date;
  limit: number;
}> {
  const octokit = new Octokit({ auth: token });
  const response = await octokit.request('GET /rate_limit');

  return {
    remaining: response.data.rate.remaining,
    reset: new Date(response.data.rate.reset * 1000),
    limit: response.data.rate.limit,
  };
}

/**
 * Check if rate limit is low and log warning
 */
export async function checkAndWarnRateLimit(token: string, threshold = 10): Promise<void> {
  try {
    const rateLimit = await checkGitHubRateLimit(token);

    if (rateLimit.remaining < threshold) {
      consola.warn(
        `GitHub rate limit low: ${rateLimit.remaining}/${rateLimit.limit} remaining. Resets at ${rateLimit.reset.toLocaleTimeString()}`
      );

      if (rateLimit.remaining === 0) {
        const waitSeconds = Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000);
        consola.warn(`Rate limit exceeded. Waiting ${waitSeconds} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 1000));
      }
    }
  } catch (error) {
    consola.debug('Failed to check rate limit:', error);
  }
}
