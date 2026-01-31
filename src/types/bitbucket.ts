import { z } from 'zod';

/**
 * Bitbucket API Response Schemas
 */

export const BitbucketUserSchema = z.object({
  uuid: z.string(),
  display_name: z.string().optional(),
});

export const BitbucketParticipantSchema = z.object({
  user: BitbucketUserSchema,
  approved: z.boolean(),
});

export const BitbucketPullRequestSchema = z.object({
  id: z.number(),
  title: z.string(),
  state: z.enum(['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED']),
  author: z.object({
    display_name: z.string(),
  }),
  links: z.object({
    html: z.object({
      href: z.string(),
    }),
  }),
  participants: z.array(BitbucketParticipantSchema).optional(),
  reviewers: z.array(BitbucketUserSchema).optional(),
  created_on: z.string().optional(),
  updated_on: z.string().optional(),
  merged_on: z.string().nullable().optional(),
});

export const BitbucketRepositorySchema = z.object({
  name: z.string(),
  full_name: z.string(),
  updated_on: z.string().optional(),
  description: z.string().nullable().optional(),
  links: z.object({
    html: z.object({
      href: z.string(),
    }),
  }),
  fork_policy: z.string().optional(),
  parent: z.object({ full_name: z.string() }).nullable().optional(), // Present if it's a fork, null otherwise
});

export const BitbucketPagedResponseSchema = z.object({
  values: z.array(z.unknown()),
  next: z.string().optional(),
});

export type BitbucketPullRequest = z.infer<typeof BitbucketPullRequestSchema>;
export type BitbucketRepository = z.infer<typeof BitbucketRepositorySchema>;
export type BitbucketPagedResponse = z.infer<typeof BitbucketPagedResponseSchema>;
