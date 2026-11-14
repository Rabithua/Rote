import { z } from 'zod';
import { campaignDetail, campaignStatus, importCodes } from '../gift/service';
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
        userid: z.uuid(),
      })
    )
    .min(1)
    .max(50_000),
});

const campaignSchema = z.object({ campaignId: z.uuid() });

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
        userid: item.userid,
      })),
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
];
