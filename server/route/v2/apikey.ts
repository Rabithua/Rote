import express from 'express';
import { User } from "@prisma/client";
import { authenticateJWT } from "../../middleware/jwtAuth";
import { generateOpenKey, getMyOpenKey, editMyOneOpenKey, deleteMyOneOpenKey } from "../../utils/dbMethods";
import { asyncHandler } from "../../utils/handlers";
import { createResponse, bodyTypeCheck, isValidUUID } from "../../utils/main";

// API密钥相关路由
const apiKeysRouter = express.Router();

// 生成API密钥
apiKeysRouter.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error('User ID is required');
    }

    const data = await generateOpenKey(user.id);
    res.status(201).json(createResponse(data));
  })
);

// 获取所有API密钥
apiKeysRouter.get(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error('User ID is required');
    }

    const data = await getMyOpenKey(user.id);
    res.status(200).json(createResponse(data));
  })
);

// 更新API密钥
apiKeysRouter.put(
  '/:id',
  authenticateJWT,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;
    const { permissions } = req.body;

    if (!user.id) {
      throw new Error('User ID is required');
    }

    if (!id || !permissions) {
      throw new Error('API Key ID and permissions are required');
    }

    const data = await editMyOneOpenKey(user.id, id, permissions);
    res.status(200).json(createResponse(data));
  })
);

// 删除API密钥
apiKeysRouter.delete(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;

    if (!user.id) {
      throw new Error('User ID is required');
    }

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid API Key ID');
    }

    const data = await deleteMyOneOpenKey(user.id, id);
    res.status(200).json(createResponse(data));
  })
);

export default apiKeysRouter;