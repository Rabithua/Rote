import express from 'express';
import { User } from "@prisma/client";
import { randomUUID } from "crypto";
import formidable from "formidable";
import { authenticateJWT } from "../../middleware/jwtAuth";
import { UploadResult } from "../../types/main";
import { createAttachments, deleteAttachment, deleteAttachments } from "../../utils/dbMethods";
import { asyncHandler } from "../../utils/handlers";
import { createResponse, isValidUUID } from "../../utils/main";
import { r2uploadhandler } from "../../utils/r2";

// 附件相关路由
const attachmentsRouter = express.Router();

// 上传附件
attachmentsRouter.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { noteId } = req.query;

    const form = formidable({
      multiples: true,
      maxFileSize: 20 * 1024 * 1024, // 20MB limit
      maxFiles: 9,
      maxTotalFileSize: 100 * 1024 * 1024, // 100MB limit
      filename: () => {
        return `${randomUUID()}`;
      },
    });

    const [fields, files] = await form.parse(req);
    if (!files.images) {
      throw new Error('No images uploaded');
    }

    const imageFiles = Array.isArray(files.images) ? files.images : [files.images];

    const uploadResults: UploadResult[] = [];
    for (const file of imageFiles) {
      let r2_upload_result = await r2uploadhandler(file);
      if (r2_upload_result !== null) {
        uploadResults.push(r2_upload_result);
      }
    }

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

    const data = await deleteAttachments(ids, user.id);
    res.status(200).json(createResponse(data));
  })
);

export default attachmentsRouter;