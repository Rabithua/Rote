import { z } from 'zod';
import {
  allocate,
  campaignDetail,
  campaignStatus,
  grant,
  importCodes,
  resolveUserid,
} from '../gift/service';
import { requireSuperAdmin } from './shared';
import { defineMcpTool } from './registry';
import type { McpTool } from './types';

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'invalid ISO date');

const importSchema = z.object({
  campaignName: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  codes: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(255),
        expiresAt: isoDate,
      })
    )
    .min(1)
    .max(50_000),
});

const allocateSchema = z
  .object({
    campaignId: z.uuid(),
    usernames: z.array(z.string().trim().min(1).max(100)).max(5000).optional(),
    userids: z.array(z.uuid()).max(5000).optional(),
  })
  .refine((value) => {
    const hasUsernames = (value.usernames?.length ?? 0) > 0;
    const hasUserids = (value.userids?.length ?? 0) > 0;
    return hasUsernames !== hasUserids;
  }, 'provide exactly one of usernames or userids');

const campaignSchema = z.object({ campaignId: z.uuid() });

const grantSchema = z
  .object({
    campaignId: z.uuid(),
    username: z.string().trim().min(1).max(100).optional(),
    userid: z.uuid().optional(),
  })
  .refine(
    (value) => (value.username != null) !== (value.userid != null),
    'provide exactly one of username or userid'
  );

async function resolveUserId(input: { username?: string; userid?: string }): Promise<string> {
  if (input.userid) return input.userid;
  return await resolveUserid(input.username ?? '');
}

export const giftTools: McpTool[] = [
  defineMcpTool('gift_import_codes', async (c, args) => {
    const admin = requireSuperAdmin(c);
    const parsed = importSchema.parse(args);
    return await importCodes({
      name: parsed.campaignName,
      title: parsed.title ?? null,
      description: parsed.description ?? null,
      createdBy: admin.id,
      codes: parsed.codes.map((item) => ({
        code: item.code,
        expiresAt: new Date(item.expiresAt),
      })),
    });
  }),
  defineMcpTool('gift_allocate', async (c, args) => {
    requireSuperAdmin(c);
    const parsed = allocateSchema.parse(args);
    return await allocate({
      campaignId: parsed.campaignId,
      usernames: parsed.usernames,
      userids: parsed.userids,
    });
  }),
  defineMcpTool('gift_status', async (c, args) => {
    requireSuperAdmin(c);
    const parsed = campaignSchema.parse(args);
    return await campaignStatus(parsed.campaignId);
  }),
  defineMcpTool('gift_detail', async (c, args) => {
    requireSuperAdmin(c);
    const parsed = campaignSchema.parse(args);
    return await campaignDetail(parsed.campaignId);
  }),
  defineMcpTool('gift_grant', async (c, args) => {
    requireSuperAdmin(c);
    const parsed = grantSchema.parse(args);
    const userid = await resolveUserId({ username: parsed.username, userid: parsed.userid });
    return await grant({ campaignId: parsed.campaignId, userid });
  }),
];
