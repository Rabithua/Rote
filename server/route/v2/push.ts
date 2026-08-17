import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z, type ZodType } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { pushCampaigns, type User } from '../../drizzle/schema';
import { authenticateJWT, requireSuperAdmin } from '../../middleware/jwtAuth';
import { isPushNotificationsEnabled, validateTimeZone } from '../../push/config';
import { PushApiError } from '../../push/errors';
import { isApnsPayloadWithinLimit } from '../../push/apns';
import {
  disableDevice,
  enqueuePushEvent,
  getActiveDevice,
  getPreferences,
  registerDevice,
  updatePreferences,
} from '../../push/repository';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';
import { db } from '../../utils/drizzle';

const router = new Hono<{ Variables: HonoVariables }>();

router.use('*', async (c, next) => {
  if (!isPushNotificationsEnabled()) {
    throw new PushApiError('push_not_available', 404);
  }
  await next();
});
router.use('*', authenticateJWT);

function parsePushValue<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new PushApiError('push_invalid_request', 400);
  return result.data;
}

async function parsePushBody<T>(c: HonoContext, schema: ZodType<T>): Promise<T> {
  try {
    return parsePushValue(schema, await c.req.json());
  } catch (error) {
    if (error instanceof PushApiError) throw error;
    throw new PushApiError('push_invalid_request', 400);
  }
}

const registerSchema = z.object({
  installationId: z.uuid(),
  token: z.string().regex(/^[a-fA-F0-9]{32,256}$/),
  environment: z.enum(['sandbox', 'production']),
  masterEnabled: z.boolean().optional(),
  timeZone: z.string().min(1).max(100),
});

router.put('/devices/current', async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await parsePushBody(c, registerSchema);
  const device = await registerDevice({
    userid: user.id,
    ...body,
    timeZone: validateTimeZone(body.timeZone),
  });
  return c.json(createResponse(device), 200);
});

router.delete('/devices/:installationId', async (c: HonoContext) => {
  const user = c.get('user') as User;
  const installationId = parsePushValue(z.uuid(), c.req.param('installationId'));
  const device = await disableDevice(user.id, installationId);
  if (!device) throw new PushApiError('push_device_not_found', 404);
  return c.json(createResponse(device), 200);
});

router.get('/preferences', async (c: HonoContext) => {
  const user = c.get('user') as User;
  const preferences = await getPreferences(user.id);
  return c.json(createResponse(preferences), 200);
});

const preferenceSchema = z
  .object({
    reactionsEnabled: z.boolean().optional(),
    accountEnabled: z.boolean().optional(),
    systemEnabled: z.boolean().optional(),
    dailyReminderEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

router.put('/preferences', async (c: HonoContext) => {
  const user = c.get('user') as User;
  const preferences = await updatePreferences(user.id, await parsePushBody(c, preferenceSchema));
  return c.json(createResponse(preferences), 200);
});

router.post('/devices/:installationId/test', async (c: HonoContext) => {
  const user = c.get('user') as User;
  const installationId = parsePushValue(z.uuid(), c.req.param('installationId'));
  const device = await getActiveDevice(user.id, installationId);
  if (!device) throw new PushApiError('push_device_not_found', 404);
  const event = await enqueuePushEvent({
    userid: user.id,
    type: 'system.test',
    category: 'system',
    dedupeKey: `test:${installationId}:${randomUUID()}`,
    titleLocKey: 'push.test.title',
    bodyLocKey: 'push.test.body',
    route: 'rote://home',
    payload: { targetInstallationId: installationId },
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return c.json(createResponse(event), 201);
});

const campaignSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  route: z
    .string()
    .url()
    .refine((value) => value.startsWith('rote://'))
    .optional(),
});

const campaignIdPlaceholder = '00000000-0000-0000-0000-000000000000';

function validateCampaignPayload(
  campaign: { title: string; body: string; route?: string | null },
  campaignId: string
): void {
  if (
    !isApnsPayloadWithinLimit({
      title: campaign.title,
      body: campaign.body,
      route: campaign.route,
      payload: { campaignId },
    })
  ) {
    throw new PushApiError('push_invalid_request', 400);
  }
}

router.post('/campaigns', requireSuperAdmin, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await parsePushBody(c, campaignSchema);
  validateCampaignPayload(body, campaignIdPlaceholder);
  const [campaign] = await db
    .insert(pushCampaigns)
    .values({ ...body, createdBy: user.id })
    .returning();
  return c.json(createResponse(campaign), 201);
});

router.get('/campaigns/:campaignId', requireSuperAdmin, async (c: HonoContext) => {
  const campaignId = parsePushValue(z.uuid(), c.req.param('campaignId'));
  const campaign = await db.query.pushCampaigns.findFirst({
    where: eq(pushCampaigns.id, campaignId),
  });
  if (!campaign) throw new PushApiError('push_campaign_not_found', 404);
  const deliveryStats = await db.execute(sql`
    SELECT d.status, count(*)::int AS count
    FROM push_deliveries d
    JOIN push_events e ON e.id = d."eventId"
    WHERE e."dedupeKey" LIKE ${`campaign:${campaignId}:%`}
    GROUP BY d.status
  `);
  return c.json(createResponse({ ...campaign, deliveryStats }), 200);
});

router.post('/campaigns/:campaignId/send', requireSuperAdmin, async (c: HonoContext) => {
  const campaignId = parsePushValue(z.uuid(), c.req.param('campaignId'));
  await db.transaction(async (transaction) => {
    const [campaign] = await transaction
      .select()
      .from(pushCampaigns)
      .where(eq(pushCampaigns.id, campaignId))
      .limit(1)
      .for('update');
    if (!campaign) throw new PushApiError('push_campaign_not_found', 404);
    if (campaign.status !== 'draft') {
      throw new PushApiError('push_campaign_already_sent', 409);
    }
    validateCampaignPayload(campaign, campaignId);
    await transaction.execute(sql`
      INSERT INTO push_events
        (userid, type, category, title, body, route, payload, "dedupeKey",
         status, "availableAt", "expiresAt", "createdAt", "updatedAt")
      SELECT p.userid, 'system.campaign', 'system', ${campaign.title}, ${campaign.body},
        ${campaign.route ?? null}, ${JSON.stringify({ campaignId })}::jsonb,
        'campaign:' || ${campaignId} || ':' || p.userid::text,
        'pending', now(), now() + interval '7 days', now(), now()
      FROM push_preferences p
      WHERE p."systemEnabled" = true
      ON CONFLICT ("dedupeKey") DO NOTHING
    `);
    await transaction
      .update(pushCampaigns)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(pushCampaigns.id, campaignId));
  });
  return c.json(createResponse({ sent: true }), 200);
});

export default router;
