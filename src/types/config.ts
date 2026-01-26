import { z } from 'zod';

/**
 * Configuration schema for the PRS tool
 * Supports multi-account GitHub and Bitbucket with token environment variable references
 *
 * Tokens are NEVER stored in config - only environment variable names are stored
 */

/**
 * GitHub account configuration
 * Each account references a token stored in an environment variable
 */
export const GitHubAccountConfigSchema = z.object({
  username: z.string().describe('GitHub username for this account'),
  org: z.string().describe('Organization to monitor for this account'),
  tokenEnvVar: z.string().describe('Name of environment variable containing GitHub PAT'),
});

/**
 * GitHub configuration
 * Supports multiple accounts, each with their own token
 */
export const GitHubConfigSchema = z.object({
  accounts: z
    .array(GitHubAccountConfigSchema)
    .min(1)
    .describe('List of GitHub accounts to monitor'),
});

/**
 * Bitbucket workspace configuration
 * Each workspace references a token stored in an environment variable
 */
export const BitbucketWorkspaceConfigSchema = z.object({
  workspace: z.string().describe('Bitbucket workspace slug'),
  username: z.string().describe('Bitbucket username'),
  userDisplayName: z.string().describe('Display name for the user'),
  tokenEnvVar: z
    .string()
    .describe('Name of environment variable containing Bitbucket App Password'),
});

/**
 * Bitbucket configuration
 * Supports multiple workspaces, each with their own token
 */
export const BitbucketConfigSchema = z.object({
  workspaces: z
    .array(BitbucketWorkspaceConfigSchema)
    .default([])
    .describe('List of Bitbucket workspaces to monitor'),
});

/**
 * Complete PRS configuration
 */
export const ConfigSchema = z.object({
  github: GitHubConfigSchema,
  bitbucket: BitbucketConfigSchema,
  skipBitbucket: z.boolean().default(false).describe('Skip all Bitbucket checks'),
  watchInterval: z
    .number()
    .min(1)
    .default(15)
    .describe('Refresh interval in minutes for watch mode'),
});

export type Config = z.infer<typeof ConfigSchema>;
export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;
export type GitHubAccountConfig = z.infer<typeof GitHubAccountConfigSchema>;
export type BitbucketConfig = z.infer<typeof BitbucketConfigSchema>;
export type BitbucketWorkspaceConfig = z.infer<typeof BitbucketWorkspaceConfigSchema>;
