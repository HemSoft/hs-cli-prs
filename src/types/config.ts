import { z } from 'zod';

/**
 * Configuration schema for the PRS tool
 * Supports GitHub and Bitbucket with environment variable overrides
 */

export const GitHubAccountConfigSchema = z.object({
  account: z.string(),
  org: z.string(),
});

export const GitHubConfigSchema = z.object({
  org: z.string().default('your-org'),
  token: z.string().optional(),
  // Multi-account support: specify which accounts to check and their orgs
  accounts: z.array(GitHubAccountConfigSchema).optional(),
});

export const BitbucketConfigSchema = z.object({
  workspace: z.string().default('your-workspace'),
  username: z.string().optional(),
  apiKey: z.string().optional(),
  userDisplayName: z.string().default('Your Name'),
});

export const ConfigSchema = z.object({
  github: GitHubConfigSchema,
  bitbucket: BitbucketConfigSchema,
  skipBitbucket: z.boolean().default(false),
  watchInterval: z.number().min(1).default(15),
});

export type Config = z.infer<typeof ConfigSchema>;
export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;
export type GitHubAccountConfig = z.infer<typeof GitHubAccountConfigSchema>;
export type BitbucketConfig = z.infer<typeof BitbucketConfigSchema>;
