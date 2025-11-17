import { User } from '@prisma/client';
import crypto from 'crypto';
import { Hono } from 'hono';
import { requireSecurityConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { HonoContext } from '../../types/hono';
import { changeUserPassword, createUser, passportCheckUser } from '../../utils/dbMethods';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { createResponse, sanitizeUserData } from '../../utils/main';
import { passwordChangeZod, RegisterDataZod } from '../../utils/zod';

// 认证相关路由
const authRouter = new Hono<{ Variables: HonoContext['Variables'] }>();

// 注册
authRouter.post('/register', async (c: HonoContext) => {
  const body = await c.req.json();
  const { username, password, email, nickname } = body;

  RegisterDataZod.parse(body);

  const user = await createUser({
    username,
    password,
    email,
    nickname,
  });

  if (!user.id) {
    throw new Error('Registration failed, username or email already exists');
  }

  return c.json(createResponse(user), 201);
});

// 登录 (手动实现，不再使用 Passport)
authRouter.post('/login', requireSecurityConfig, async (c: HonoContext) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  // 查找用户
  const { user, err } = await passportCheckUser({ username });
  if (err || !user) {
    throw new Error('User not found.');
  }

  // 验证密码
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      user.salt,
      310000,
      32,
      'sha256',
      async (err: any, hashedPassword: any) => {
        if (err || !user) {
          return reject(new Error('Authentication failed'));
        }

        if (!crypto.timingSafeEqual(Buffer.from(user?.passwordhash), hashedPassword)) {
          return reject(new Error('Incorrect username or password.'));
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

          const response = c.json(
            createResponse(
              {
                user: sanitizeUserData(user),
                accessToken,
                refreshToken,
              },
              'Login successful'
            ),
            200
          );
          return resolve(response);
        } catch (error) {
          return reject(new Error('Token generation failed'));
        }
      }
    );
  });
});

// 修改密码
authRouter.put('/password', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();
  const { newpassword, oldpassword } = body;

  const zodData = passwordChangeZod.safeParse(body);
  if (zodData.success === false) {
    throw new Error(zodData.error.issues[0].message);
  }

  const updatedUser = await changeUserPassword(oldpassword, newpassword, user.id);
  return c.json(createResponse(updatedUser), 200);
});

// Token 刷新端点
authRouter.post('/refresh', requireSecurityConfig, async (c: HonoContext) => {
  const body = await c.req.json();
  const { refreshToken } = body;

  if (!refreshToken) {
    return c.json(createResponse(null, 'Refresh token required', 401), 401);
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

    return c.json(
      createResponse(
        {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
        'Token refreshed successfully'
      ),
      200
    );
  } catch (error) {
    return c.json(createResponse(null, 'Invalid refresh token', 401), 401);
  }
});

export default authRouter;
