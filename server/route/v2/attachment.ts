import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import type { User } from '../../drizzle/schema';
import { requireStorageConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { StorageConfig, UiConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import type { UploadResult } from '../../types/main';
import { getConfig, getGlobalConfig } from '../../utils/config';
import {
  deleteAttachment,
  deleteAttachments,
  updateAttachmentsSortOrder,
  upsertAttachmentsByOriginalKey,
} from '../../utils/dbMethods';
import { validateContentType } from '../../utils/fileValidation';
import { createResponse, isValidUUID } from '../../utils/main';
import { checkObjectExists, presignPutUrl } from '../../utils/r2';
import { AttachmentPresignZod } from '../../utils/zod';

// 附件相关路由
const attachmentsRouter = new Hono<{ Variables: HonoVariables }>();

// 文件上传限制常量
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 9;
const MAX_BATCH_SIZE = 100; // 批量操作最大数量限制

/**
 * 验证文件大小（用于 presign 接口）
 * @param size 文件大小（字节）
 * @throws Error 如果文件大小无效
 */
function validateFileSize(size: number | undefined | null): void {
  if (size === undefined || size === null) {
    throw new Error('File size (size) is required');
  }
  if (size <= 0) {
    throw new Error('File size must be greater than 0');
  }
  if (size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit: ${MAX_FILE_SIZE} bytes`);
  }
}

// 删除单个附件
attachmentsRouter.delete('/:id', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid attachment ID');
  }

  const data = await deleteAttachment(id, user.id);
  return c.json(createResponse(data), 200);
});

// 批量删除附件
attachmentsRouter.delete('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();
  const { ids } = body;

  if (!ids || ids.length === 0) {
    throw new Error('No attachments to delete');
  }

  // 限制批量删除的数量，防止滥用
  if (ids.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} attachments can be deleted at once`);
  }

  const data = await deleteAttachments(
    ids.map((id: string) => ({ id })),
    user.id
  );
  return c.json(createResponse(data), 200);
});

// 更新附件排序
attachmentsRouter.put('/sort', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();
  const { roteId, attachmentIds } = body as {
    roteId: string;
    attachmentIds: string[];
  };

  if (!roteId || !isValidUUID(roteId)) {
    throw new Error('Invalid rote ID');
  }

  if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
    throw new Error('Invalid attachment IDs');
  }

  // 限制批量更新的数量，防止滥用
  if (attachmentIds.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} attachments can be sorted at once`);
  }

  // 验证所有附件ID格式
  for (const id of attachmentIds) {
    if (!isValidUUID(id)) {
      throw new Error(`Invalid attachment ID: ${id}`);
    }
  }

  const data = await updateAttachmentsSortOrder(user.id, roteId, attachmentIds);
  return c.json(createResponse(data), 200);
});

// 预签名直传（前端直接 PUT 到 R2）
attachmentsRouter.post(
  '/presign',
  authenticateJWT,
  requireStorageConfig,
  async (c: HonoContext) => {
    // 检查是否允许上传文件
    const uiConfig = await getConfig<UiConfig>('ui');
    if (uiConfig && uiConfig.allowUploadFile === false) {
      return c.json(createResponse(null, 'File upload is currently disabled'), 403);
    }

    const user = c.get('user') as User;
    const body = await c.req.json();
    const { files } = body as {
      files: Array<{ filename?: string; contentType?: string; size?: number }>;
    };

    // 验证输入长度和格式
    AttachmentPresignZod.parse(body);

    // 验证文件数量限制（zod 已经验证，但保留作为双重检查）
    if (files.length > MAX_FILES) {
      throw new Error(`Maximum ${MAX_FILES} files allowed`);
    }

    // 严格验证每个文件的内容类型和大小
    for (const f of files) {
      // 验证 contentType 必须提供且符合允许的类型
      // validateContentType 内部会检查 contentType 是否存在
      validateContentType(f.contentType);

      // 验证文件大小必须提供且不能超过限制
      validateFileSize(f.size);
    }

    const getExt = (filename?: string, contentType?: string) => {
      if (filename && filename.includes('.')) return `.${filename.split('.').pop()}`;
      if (!contentType) return '';
      const map: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/heic': '.heic',
        'image/heif': '.heif',
        'image/avif': '.avif',
        'image/svg+xml': '.svg',
      };
      return map[contentType] || '';
    };

    const results = await Promise.all(
      files.map(async (f) => {
        const uuid = randomUUID();
        const ext = getExt(f.filename, f.contentType);
        const originalKey = `users/${user.id}/uploads/${uuid}${ext}`;
        const compressedKey = `users/${user.id}/compressed/${uuid}.webp`;

        const [original, compressed] = await Promise.all([
          presignPutUrl(originalKey, f.contentType || undefined, 15 * 60),
          presignPutUrl(compressedKey, 'image/webp', 15 * 60),
        ]);

        return {
          uuid,
          original: {
            key: originalKey,
            putUrl: original.putUrl,
            url: original.url,
            contentType: f.contentType,
          },
          compressed: {
            key: compressedKey,
            putUrl: compressed.putUrl,
            url: compressed.url,
            contentType: 'image/webp',
          },
        };
      })
    );

    return c.json(createResponse({ items: results }), 200);
  }
);

// 完成回调：将已上传对象入库（可选绑定 noteId）
attachmentsRouter.post(
  '/finalize',
  authenticateJWT,
  requireStorageConfig,
  async (c: HonoContext) => {
    const user = c.get('user') as User;
    const body = await c.req.json();
    const { attachments, noteId } = body as {
      attachments: Array<{
        uuid: string;
        originalKey: string;
        compressedKey?: string;
        size?: number;
        mimetype?: string;
        hash?: string;
        noteId?: string;
      }>;
      noteId?: string;
    };

    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      throw new Error('No attachments to finalize');
    }

    // 限制批量完成的数量，防止滥用
    if (attachments.length > MAX_BATCH_SIZE) {
      throw new Error(`Maximum ${MAX_BATCH_SIZE} attachments can be finalized at once`);
    }

    // 简单的所有权校验：Key 必须在当前用户前缀下
    const prefix = `users/${user.id}/`;
    const invalid = attachments.find((a) => !a.originalKey?.startsWith(prefix));
    if (invalid) {
      throw new Error('Invalid object key');
    }

    // 验证 mimetype（如果提供）
    for (const a of attachments) {
      if (a.mimetype) {
        validateContentType(a.mimetype);
      }
    }

    // 验证文件存在性和 UUID 一致性
    const validationErrors: string[] = [];
    const validAttachments: typeof attachments = [];

    for (const a of attachments) {
      // 1. 验证原图文件是否存在
      const originalExists = await checkObjectExists(a.originalKey);
      if (!originalExists) {
        validationErrors.push(`Original file not found: ${a.originalKey} (uuid: ${a.uuid})`);
        continue;
      }

      // 2. 如果提供了 compressedKey，验证压缩图是否存在
      if (a.compressedKey) {
        const compressedExists = await checkObjectExists(a.compressedKey);
        if (!compressedExists) {
          validationErrors.push(`Compressed file not found: ${a.compressedKey} (uuid: ${a.uuid})`);
          // 压缩图不存在，但不阻止原图入库，只是不传递 compressedKey
          validAttachments.push({
            ...a,
            compressedKey: undefined,
          });
          continue;
        }

        // 3. 验证 UUID 一致性：确保 compressedKey 中的 uuid 与 originalKey 中的 uuid 一致
        // originalKey 格式: users/{userId}/uploads/{uuid}{ext}
        // compressedKey 格式: users/{userId}/compressed/{uuid}.webp
        // 使用更精确的正则表达式：([^/.]+) 匹配 UUID（不包含 / 和 .），然后匹配可选的扩展名
        const originalUuidMatch = a.originalKey.match(/\/uploads\/([^/.]+)(\.[^.]+)?$/);
        const compressedUuidMatch = a.compressedKey.match(/\/compressed\/([^/.]+)\.webp$/);

        if (!originalUuidMatch || !compressedUuidMatch) {
          validationErrors.push(
            `Invalid key format for uuid validation: originalKey=${a.originalKey}, compressedKey=${a.compressedKey}`
          );
          continue;
        }

        const originalUuid = originalUuidMatch[1];
        const compressedUuid = compressedUuidMatch[1];

        if (originalUuid !== compressedUuid) {
          validationErrors.push(
            `UUID mismatch: originalKey contains uuid '${originalUuid}', but compressedKey contains uuid '${compressedUuid}'`
          );
          // UUID 不匹配，不传递 compressedKey
          validAttachments.push({
            ...a,
            compressedKey: undefined,
          });
          continue;
        }

        // 4. 验证 compressedKey 中的 uuid 是否与请求中的 uuid 一致
        if (originalUuid !== a.uuid) {
          validationErrors.push(
            `UUID mismatch: request uuid '${a.uuid}' does not match originalKey uuid '${originalUuid}'`
          );
          continue;
        }
      }

      // 所有验证通过
      validAttachments.push(a);
    }

    // 如果没有有效的附件，返回错误
    if (validAttachments.length === 0) {
      // 如果有验证错误，返回详细错误信息
      if (validationErrors.length > 0) {
        const errorMessage =
          validationErrors.length === 1
            ? validationErrors[0]
            : `${validationErrors.length} validation error(s): ${validationErrors.join('; ')}`;
        throw new Error(errorMessage);
      }
      throw new Error('No valid attachments to finalize after validation');
    }

    // 如果有验证错误但仍有有效附件，记录警告（部分成功）
    if (validationErrors.length > 0) {
      console.warn(
        `Some attachments failed validation (${validationErrors.length} error(s)), but ${validAttachments.length} attachment(s) will be finalized:`,
        validationErrors
      );
    }

    const uploads: UploadResult[] = validAttachments.map((a) => {
      const storageConfig = getGlobalConfig<StorageConfig>('storage');
      const urlPrefix = storageConfig?.urlPrefix;
      const oUrl = `${urlPrefix}/${a.originalKey}`;
      const cUrl = a.compressedKey ? `${urlPrefix}/${a.compressedKey}` : null;
      const baseDetails: any = {
        size: a.size || 0,
        mimetype: a.mimetype || null,
        mtime: new Date().toISOString(),
        key: a.originalKey,
      };
      if (a.compressedKey) baseDetails.compressKey = a.compressedKey;
      if (a.hash) baseDetails.hash = a.hash;

      return {
        url: oUrl,
        compressUrl: cUrl,
        details: baseDetails,
      };
    });

    const data = await upsertAttachmentsByOriginalKey(
      user.id,
      (noteId as string | undefined) || undefined,
      uploads
    );

    return c.json(createResponse(data), 201);
  }
);

export default attachmentsRouter;
