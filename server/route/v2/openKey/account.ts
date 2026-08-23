import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoContext, HonoVariables } from '../../../types/hono';
import {
  editMyProfile,
  getHeatMap,
  getMyProfile,
  getMySettings,
  getMyTags,
  statistics,
  updateMySettings,
} from '../../../utils/dbMethods';
import { createResponse } from '../../../utils/main';
import { UsernameUpdateZod } from '../../../utils/zod';
import { requireOpenKey, requireOpenKeyPerm } from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

const NullableText = z.string().nullable().optional();
const ProfileUpdateZod = z.object({
  avatar: NullableText,
  avatarAttachmentId: z.string().uuid('Invalid avatar attachment').nullable().optional(),
  nickname: NullableText,
  description: NullableText,
  cover: NullableText,
  coverAttachmentId: z.string().uuid('Invalid cover attachment').nullable().optional(),
  username: UsernameUpdateZod.shape.username.optional(),
});
const SettingsUpdateZod = z.object({
  allowExplore: z.boolean().optional(),
});

function validateDateRange(startDate: string | undefined, endDate: string | undefined) {
  if (!startDate || !endDate) throw new Error('startDate and endDate are required');
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  for (const [label, value] of [
    ['startDate', startDate],
    ['endDate', endDate],
  ] as const) {
    const date = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new Error(`Invalid ${label}: not a valid calendar date`);
    }
  }
  return { startDate, endDate };
}

router.get('/permissions', async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  return c.json(createResponse({ permissions: openKey.permissions }), 200);
});

router.get('/profile', requireOpenKeyPerm('EDITPROFILE'), async (c: HonoContext) => {
  const profile = await getMyProfile(requireOpenKey(c).userid);
  return c.json(createResponse(profile), 200);
});

router.put('/profile', requireOpenKeyPerm('EDITPROFILE'), async (c: HonoContext) => {
  const input = ProfileUpdateZod.parse(await c.req.json());
  const profile = await editMyProfile(requireOpenKey(c).userid, input);
  return c.json(createResponse(profile), 200);
});

router.get('/tags', requireOpenKeyPerm('GETTAGS'), async (c: HonoContext) => {
  const tags = await getMyTags(requireOpenKey(c).userid);
  return c.json(createResponse(tags), 200);
});

router.get('/heatmap', requireOpenKeyPerm('GETSTATISTICS'), async (c: HonoContext) => {
  const { startDate, endDate } = validateDateRange(
    c.req.query('startDate'),
    c.req.query('endDate')
  );
  const heatmap = await getHeatMap(requireOpenKey(c).userid, startDate, endDate);
  return c.json(createResponse(heatmap), 200);
});

router.get('/statistics', requireOpenKeyPerm('GETSTATISTICS'), async (c: HonoContext) => {
  const result = await statistics(requireOpenKey(c).userid);
  return c.json(createResponse(result), 200);
});

router.get('/settings', requireOpenKeyPerm('GETSETTINGS'), async (c: HonoContext) => {
  const settings = await getMySettings(requireOpenKey(c).userid);
  return c.json(createResponse(settings), 200);
});

router.put('/settings', requireOpenKeyPerm('EDITSETTINGS'), async (c: HonoContext) => {
  const input = SettingsUpdateZod.parse(await c.req.json());
  const settings = await updateMySettings(requireOpenKey(c).userid, input);
  return c.json(createResponse(settings), 200);
});

export default router;
