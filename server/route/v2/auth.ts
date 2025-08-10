import { User } from '@prisma/client';
import express from 'express';
import passport from 'passport';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { createUser, changeUserPassword } from '../../utils/dbMethods';
import { asyncHandler } from '../../utils/handlers';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { createResponse, sanitizeUserData } from '../../utils/main';
import { RegisterDataZod, passwordChangeZod } from '../../utils/zod';


// 认证相关路由
const authRouter = express.Router();

// 注册
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { username, password, email, nickname } = req.body;

    RegisterDataZod.parse(req.body);

    const user = await createUser({
      username,
      password,
      email,
      nickname,
    });

    if (!user.id) {
      throw new Error('Registration failed, username or email already exists');
    }

    res.status(201).json(createResponse(user));
  })
);

// 登录 (使用JWT认证)
authRouter.post(
  '/login',
  asyncHandler(async (req, res, next) => {
    passport.authenticate('local', async (err: any, user: User, data: any) => {
      if (err || !user) {
        next(new Error(data.message || 'Authentication failed'));
        return;
      }

      try {
        // 生成 JWT tokens (完全无状态，不存储到数据库)
        const accessToken = await generateAccessToken({
          userId: user.id,
          username: user.username,
        });
        const refreshToken = await generateRefreshToken({
          userId: user.id,
          username: user.username,
        });

        res.status(200).json(
          createResponse(
            {
              user: sanitizeUserData(user),
              accessToken,
              refreshToken,
            },
            'Login successful'
          )
        );
      } catch (error) {
        next(new Error('Token generation failed'));
      }
    })(req, res, next);
  })
);

// 修改密码
authRouter.put(
  '/password',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { newpassword, oldpassword } = req.body;

    const zodData = passwordChangeZod.safeParse(req.body);
    if (zodData.success === false) {
      throw new Error(zodData.error.errors[0].message);
    }

    const updatedUser = await changeUserPassword(oldpassword, newpassword, user.id);
    res.status(200).json(createResponse(updatedUser));
  })
);

// Token 刷新端点
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json(createResponse(null, 'Refresh token required', 401));
    }

    try {
      const payload = await verifyRefreshToken(refreshToken);
      const newAccessToken = await generateAccessToken({
        userId: payload.userId,
        username: payload.username,
      });
      const newRefreshToken = await generateRefreshToken({
        userId: payload.userId,
        username: payload.username,
      });

      res.status(200).json(
        createResponse(
          {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
          'Token refreshed successfully'
        )
      );
    } catch (error) {
      res.status(401).json(createResponse(null, 'Invalid refresh token', 401));
    }
  })
);

export default authRouter;