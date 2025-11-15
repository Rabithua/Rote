import { User } from '@prisma/client';
import { randomUUID } from 'crypto';
import express from 'express';
import formidable from 'formidable';
import { requireStorageConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { StorageConfig } from '../../types/config';
import { UploadResult } from '../../types/main';
import { getGlobalConfig } from '../../utils/config';
import {
  createAttachments,
  deleteAttachment,
  deleteAttachments,
  updateAttachmentsSortOrder,
  upsertAttachmentsByOriginalKey,
} from '../../utils/dbMethods';
import { validateContentType, validateFile } from '../../utils/fileValidation';
import { asyncHandler } from '../../utils/handlers';
import { createResponse, isValidUUID } from '../../utils/main';
import { presignPutUrl, r2uploadhandler } from '../../utils/r2';
import { AttachmentPresignZod } from '../../utils/zod';

// 附件相关路由
const attachmentsRouter = express.Router();

// 文件上传限制常量
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 9;
const MAX_TOTAL_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_BATCH_SIZE = 100; // 批量操作最大数量限制

/**
 * 验证文件大小（用于 presign 接口）
 * @param size 文件大小（字节）
 * @throws Error 如果文件大小无效
 */
function validateFileSize(size: number | undefined | null): void {
  if (size === undefined || size === null) {
    throw new Error('缺少文件大小 (size)');
  }
  if (size <= 0) {
    throw new Error('文件大小必须大于 0');
  }
  if (size > MAX_FILE_SIZE) {
    throw new Error(`文件大小超过限制: ${MAX_FILE_SIZE} 字节`);
  }
}

// 上传附件
attachmentsRouter.post(
  '/',
  authenticateJWT,
  requireStorageConfig,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { noteId } = req.query;

    const form = formidable({
      multiples: true,
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES,
      maxTotalFileSize: MAX_TOTAL_FILE_SIZE,
      filename: () => {
        return `${randomUUID()}`;
      },
    });

    const [fields, files] = await form.parse(req);
    if (!files.images) {
      throw new Error('No images uploaded');
    }

    const imageFiles = Array.isArray(files.images) ? files.images : [files.images];

    // 验证每个文件的类型和内容
    for (const file of imageFiles) {
      await validateFile(file);
    }

    // 并发控制，避免单次请求时间过长导致中断
    const CONCURRENCY = 3; // 保留并发配置，因为这是性能调优必需的
    const queue: Promise<void>[] = [];
    const uploadResults: UploadResult[] = [];

    let idx = 0;
    const worker = async () => {
      while (idx < imageFiles.length) {
        const current = imageFiles[idx++];
        try {
          const result = await r2uploadhandler(current);
          if (result) uploadResults.push(result);
        } catch (e) {
          // 单个文件失败不影响整体
          console.error('Upload one file failed:', e);
        }
      }
    };

    for (let i = 0; i < Math.min(CONCURRENCY, imageFiles.length); i++) {
      queue.push(worker());
    }
    await Promise.all(queue);

    const data = await createAttachments(user.id, noteId as string | undefined, uploadResults);

    res.status(201).json(createResponse(data));
  })
);

// 删除单个附件
attachmentsRouter.delete(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid attachment ID');
    }

    const data = await deleteAttachment(id, user.id);
    res.status(200).json(createResponse(data));
  })
);

// 批量删除附件
attachmentsRouter.delete(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { ids } = req.body;

    if (!ids || ids.length === 0) {
      throw new Error('No attachments to delete');
    }

    // 限制批量删除的数量，防止滥用
    if (ids.length > MAX_BATCH_SIZE) {
      throw new Error(`最多允许一次删除 ${MAX_BATCH_SIZE} 个附件`);
    }

    const data = await deleteAttachments(
      ids.map((id: string) => ({ id })),
      user.id
    );
    res.status(200).json(createResponse(data));
  })
);

// 更新附件排序
attachmentsRouter.put(
  '/sort',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { roteId, attachmentIds } = req.body as {
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
      throw new Error(`最多允许一次更新 ${MAX_BATCH_SIZE} 个附件的排序`);
    }

    // 验证所有附件ID格式
    for (const id of attachmentIds) {
      if (!isValidUUID(id)) {
        throw new Error(`Invalid attachment ID: ${id}`);
      }
    }

    const data = await updateAttachmentsSortOrder(user.id, roteId, attachmentIds);
    res.status(200).json(createResponse(data));
  })
);

// 预签名直传（前端直接 PUT 到 R2）
attachmentsRouter.post(
  '/presign',
  authenticateJWT,
  requireStorageConfig,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { files } = req.body as {
      files: Array<{ filename?: string; contentType?: string; size?: number }>;
    };

    // 验证输入长度和格式
    AttachmentPresignZod.parse(req.body);

    // 验证文件数量限制（zod 已经验证，但保留作为双重检查）
    if (files.length > MAX_FILES) {
      throw new Error(`最多允许 ${MAX_FILES} 个文件`);
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

    res.status(200).json(createResponse({ items: results }));
  })
);

// 完成回调：将已上传对象入库（可选绑定 noteId）
attachmentsRouter.post(
  '/finalize',
  authenticateJWT,
  requireStorageConfig,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { attachments, noteId } = req.body as {
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
      throw new Error(`最多允许一次完成 ${MAX_BATCH_SIZE} 个附件的入库`);
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

    const uploads: UploadResult[] = attachments.map((a) => {
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

    res.status(201).json(createResponse(data));
  })
);

export default attachmentsRouter;
