import { Hono } from 'hono';
import { finalizeAttachmentUploads } from '../../attachments/finalizeUpload';
import { presignAttachmentUploads } from '../../attachments/presignUpload';
import type { FinalizeAttachmentInput, PresignFileInput } from '../../attachments/types';
import {
  finalizeInputIncludesVideo,
  presignInputIncludesVideo,
} from '../../attachments/uploadMedia';
import { getAttachmentUploadPolicy } from '../../attachments/uploadPolicy';
import type { User } from '../../drizzle/schema';
import { requireStorageConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  deleteAttachment,
  deleteAttachments,
  updateAttachmentsSortOrder,
} from '../../utils/dbMethods';
import { MAX_BATCH_SIZE } from '../../utils/fileValidation';
import { createResponse, isValidUUID } from '../../utils/main';
import { AttachmentPresignZod } from '../../utils/zod';

const attachmentsRouter = new Hono<{ Variables: HonoVariables }>();

attachmentsRouter.delete('/:id', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  if (!id || !isValidUUID(id)) throw new Error('Invalid attachment ID');

  const data = await deleteAttachment(id, user.id);
  return c.json(createResponse(data), 200);
});

attachmentsRouter.delete('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const { ids } = (await c.req.json()) as { ids?: string[] };
  if (!ids || ids.length === 0) throw new Error('No attachments to delete');
  if (ids.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} attachments can be deleted at once`);
  }

  const data = await deleteAttachments(
    ids.map((id) => ({ id })),
    user.id
  );
  return c.json(createResponse(data), 200);
});

attachmentsRouter.put('/sort', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const { roteId, attachmentIds } = (await c.req.json()) as {
    roteId?: string;
    attachmentIds?: string[];
  };
  if (!roteId || !isValidUUID(roteId)) throw new Error('Invalid rote ID');
  if (!attachmentIds || attachmentIds.length === 0) {
    throw new Error('Invalid attachment IDs');
  }
  if (attachmentIds.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} attachments can be sorted at once`);
  }
  for (const id of attachmentIds) {
    if (!isValidUUID(id)) throw new Error(`Invalid attachment ID: ${id}`);
  }

  const data = await updateAttachmentsSortOrder(user.id, roteId, attachmentIds);
  return c.json(createResponse(data), 200);
});

attachmentsRouter.post(
  '/presign',
  authenticateJWT,
  requireStorageConfig,
  async (c: HonoContext) => {
    const user = c.get('user') as User;
    const body = await c.req.json();
    AttachmentPresignZod.parse(body);
    const { files } = body as { files: PresignFileInput[] };
    const uploadPolicy = await getAttachmentUploadPolicy(user.id);
    if (!uploadPolicy.canUploadAttachments) {
      return c.json(createResponse(null, 'capability_required:attachment.upload'), 403);
    }
    if (presignInputIncludesVideo(files) && !uploadPolicy.canUploadVideo) {
      return c.json(createResponse(null, 'capability_required:attachment.video.upload'), 403);
    }
    const result = await presignAttachmentUploads({
      files,
      scopes: ['video:upload'],
      userId: user.id,
    });
    return c.json(createResponse(result), 200);
  }
);

attachmentsRouter.post(
  '/finalize',
  authenticateJWT,
  requireStorageConfig,
  async (c: HonoContext) => {
    const user = c.get('user') as User;
    const { attachments, noteId } = (await c.req.json()) as {
      attachments?: FinalizeAttachmentInput[];
      noteId?: string;
    };
    const uploadPolicy = await getAttachmentUploadPolicy(user.id);
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
    const result = await finalizeAttachmentUploads({
      attachments,
      noteId,
      scopes: ['video:upload'],
      userId: user.id,
    });
    return c.json(createResponse(result), 201);
  }
);

export default attachmentsRouter;
