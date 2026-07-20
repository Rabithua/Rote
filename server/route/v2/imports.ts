import { Hono } from 'hono';
import { requestWereadGateway, WereadGatewayError } from '../../integrations/wereadGateway';
import { attachmentSchema } from '../../imports/importSchema';
import {
  migrateOneRemoteAttachment,
  RemoteAttachmentMigrationError,
} from '../../imports/remoteAttachmentMigrationService';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import type { User } from '../../drizzle/schema';
import { createResponse } from '../../utils/main';

const importsRouter = new Hono<{ Variables: HonoVariables }>();

importsRouter.post('/attachments/migrate', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json().catch(() => null);
  const parsed = attachmentSchema.safeParse(
    body && typeof body === 'object' ? (body as { attachment?: unknown }).attachment : undefined
  );
  if (!parsed.success) {
    return c.json(createResponse(null, 'remote_attachment_invalid', 1), 422);
  }
  try {
    const attachment = await migrateOneRemoteAttachment(user.id, parsed.data);
    return c.json(createResponse(attachment), 201);
  } catch (error) {
    if (error instanceof RemoteAttachmentMigrationError) {
      return c.json(createResponse(null, error.code, 1), error.status);
    }
    throw error;
  }
});

importsRouter.post('/weread', authenticateJWT, async (c: HonoContext) => {
  try {
    const data = await requestWereadGateway({
      apiKey: c.req.header('x-weread-api-key')?.trim(),
      body: await c.req.json().catch(() => null),
    });
    return c.json(createResponse(data), 200);
  } catch (error) {
    if (error instanceof WereadGatewayError) {
      return c.json(
        createResponse(null, error.code, 1),
        error.status as 400 | 401 | 403 | 502 | 504
      );
    }
    throw error;
  }
});

export default importsRouter;
