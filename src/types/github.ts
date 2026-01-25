import { z } from 'zod';

/**
 * GitHub API Response Schemas
 */

export const GitHubUserSchema = z.object({
  login: z.string(),
});

export const GitHubReviewSchema = z.object({
  state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING']),
  author: z.object({
    login: z.string(),
  }),
  submittedAt: z.string().optional(),
});

export const GitHubAssigneeSchema = z.object({
  login: z.string(),
});

export const GitHubPullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
  author: z.object({
    login: z.string(),
  }),
  repository: z
    .object({
      name: z.string(),
    })
    .optional(),
  reviews: z.array(GitHubReviewSchema).optional(),
  assignees: z.array(GitHubAssigneeSchema).optional(),
  createdAt: z.string(),
  mergedAt: z.string().nullable().optional(),
});

export const GitHubSearchResultSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  repository: z.object({
    name: z.string(),
  }),
});

export type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;
export type GitHubSearchResult = z.infer<typeof GitHubSearchResultSchema>;
export type GitHubReview = z.infer<typeof GitHubReviewSchema>;
