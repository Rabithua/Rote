import { Hono } from 'hono';
import { finalizeAttachmentReservation } from '../../attachments/finalizeReservation';
import { finalizeAttachmentUploads } from '../../attachments/finalizeUpload';
import {
  presignAttachmentUploads,
  refreshAttachmentUploadReservation,
} from '../../attachments/presignUpload';
import type { FinalizeAttachmentInput, PresignAttachmentInput } from '../../attachments/types';
import {
  finalizeInputIncludesVideo,
  presignInputIncludesVideo,
} from '../../attachments/uploadMedia';
import { getAttachmentUploadPolicy } from '../../attachments/uploadPolicy';
import { requireStorageConfig } from '../../middleware/configCheck';
import { isOpenKeyOk } from '../../openKey/middleware';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';
import { AttachmentPresignZod } from '../../utils/zod';

const openKeyAttachmentRouter = new Hono<{ Variables: HonoVariables }>();

function requireOpenKeyPermission(permission: string) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const openKey = c.get('openKey');
    if (!openKey) throw new Error('Need openkey!');
    if (!openKey.permissions?.includes(permission)) {
      throw new Error('API key permission does not match');
    }
    await next();
  };
}

function canUploadVideo(permissions: string[]): boolean {
  return permissions.includes('UPLOADVIDEO');
}

openKeyAttachmentRouter.post(
  '/attachments/reservations/:reservationId/refresh',
  isOpenKeyOk,
  requireOpenKeyPermission('UPLOADATTACHMENT'),
  requireStorageConfig,
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const reservationId = c.req.param('reservationId');
    if (!/^[0-9a-f-]{36}$/i.test(reservationId)) throw new Error('Invalid reservation ID');
    return c.json(
      createResponse(await refreshAttachmentUploadReservation(openKey.userid, reservationId))
    );
  }
);

openKeyAttachmentRouter.post(
  '/attachments/presign',
  isOpenKeyOk,
  requireOpenKeyPermission('UPLOADATTACHMENT'),
  requireStorageConfig,
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const body = await c.req.json();
    AttachmentPresignZod.parse(body);
    const { files, browserDirectUpload } = body as PresignAttachmentInput;
    const videoAllowed = canUploadVideo(openKey.permissions);
    if (presignInputIncludesVideo(files) && !videoAllowed) {
      return c.json(createResponse(null, 'openkey_permission_required:UPLOADVIDEO'), 403);
    }
    const uploadPolicy = await getAttachmentUploadPolicy(openKey.userid);
    if (!uploadPolicy.canUploadAttachments) {
      return c.json(createResponse(null, 'capability_required:attachment.upload'), 403);
    }
    if (presignInputIncludesVideo(files) && !uploadPolicy.canUploadVideo) {
      return c.json(createResponse(null, 'capability_required:attachment.video.upload'), 403);
    }

    const result = await presignAttachmentUploads({
      files,
      browserDirectUpload,
      scopes: videoAllowed ? ['video:upload'] : [],
      userId: openKey.userid,
    });
    return c.json(createResponse(result), 200);
  }
);

openKeyAttachmentRouter.post(
  '/attachments/finalize',
  isOpenKeyOk,
  requireOpenKeyPermission('UPLOADATTACHMENT'),
  requireStorageConfig,
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const body = await c.req.json();
    const { attachments, noteId, reservationId } = body as {
      attachments?: FinalizeAttachmentInput[];
      noteId?: string;
      reservationId?: string;
    };
    const videoAllowed = canUploadVideo(openKey.permissions);
    if (Array.isArray(attachments) && finalizeInputIncludesVideo(attachments) && !videoAllowed) {
      return c.json(createResponse(null, 'openkey_permission_required:UPLOADVIDEO'), 403);
    }
    const uploadPolicy = await getAttachmentUploadPolicy(openKey.userid);
    if (!uploadPolicy.canUploadAttachments) {
      return c.json(createResponse(null, 'capability_required:attachment.upload'), 403);
    }
    if (
      Array.isArray(attachments) &&
      finalizeInputIncludesVideo(attachments) &&
      !uploadPolicy.canUploadVideo
    ) {
      return c.json(createResponse(null, 'capability_required:attachment.video.upload'), 403);
    }

    const input = {
      attachments: attachments ?? [],
      noteId,
      scopes: videoAllowed ? ['video:upload'] : [],
      userId: openKey.userid,
    };
    const result = reservationId
      ? await finalizeAttachmentReservation({ ...input, reservationId })
      : await finalizeAttachmentUploads(input);
    return c.json(createResponse(result), 201);
  }
);

export default openKeyAttachmentRouter;
