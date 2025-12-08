import crypto from 'crypto';
import { Hono } from 'hono';
import type { User } from '../../drizzle/schema';
import { requireSecurityConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { UiConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getConfig } from '../../utils/config';
import { changeUserPassword, createUser, oneUser, passportCheckUser } from '../../utils/dbMethods';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { createResponse, sanitizeUserData } from '../../utils/main';
import { passwordChangeZod, RegisterDataZod } from '../../utils/zod';

// 认证相关路由
const authRouter = new Hono<{ Variables: HonoVariables }>();

// 注册
authRouter.post('/register', async (c: HonoContext) => {
  // 检查是否允许注册
  const uiConfig = await getConfig<UiConfig>('ui');
  if (uiConfig && uiConfig.allowRegistration === false) {
    return c.json(createResponse(null, 'Registration is currently disabled'), 403);
  }

  const body = await c.req.json();
  const { username, password, email, nickname } = body;

  RegisterDataZod.parse(body);

  // 使用配置中的默认用户角色，如果没有配置则使用 'user'
  const defaultRole = uiConfig?.defaultUserRole || 'user';

  const user = await createUser({
    username,
    password,
    email,
    nickname,
    role: defaultRole,
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

  // 检查用户是否是 OAuth 用户（OAuth 用户不能使用密码登录）
  if (!user.passwordhash || !user.salt) {
    throw new Error('This account uses OAuth login. Please use GitHub to sign in.');
  }

  // 验证密码
  // 此时 TypeScript 仍认为 passwordhash 和 salt 可能为 null，需要明确断言
  const passwordhash = user.passwordhash;
  const salt = user.salt;
  if (!passwordhash || !salt) {
    throw new Error('Password hash or salt is missing');
  }

  // TypeScript 类型守卫：确保类型正确
  const saltBuffer: Buffer = Buffer.isBuffer(salt)
    ? salt
    : Buffer.from(salt as unknown as string | ArrayLike<number>);
  const passwordhashBuffer: Buffer = Buffer.isBuffer(passwordhash)
    ? passwordhash
    : Buffer.from(passwordhash as unknown as string | ArrayLike<number>);

  return new Promise<Response>((resolve, reject) => {
    crypto.pbkdf2(
      password,
      saltBuffer,
      310000,
      32,
      'sha256',
      async (err: any, hashedPassword: Buffer) => {
        if (err || !user) {
          return reject(new Error('Authentication failed'));
        }

        try {
          const isEqual = crypto.timingSafeEqual(passwordhashBuffer, hashedPassword);

          if (!isEqual) {
            return reject(new Error('Incorrect username or password.'));
          }

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
          resolve(response);
        } catch (_tokenError) {
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

  // 检查用户是否是 OAuth 用户（OAuth 用户不能修改密码）
  const fullUser = await oneUser(user.id);
  if (!fullUser) {
    throw new Error('User not found');
  }
  if (fullUser.authProvider !== 'local' || !fullUser.passwordhash || !fullUser.salt) {
    throw new Error('OAuth users cannot change password. Please use OAuth login.');
  }

  const zodData = passwordChangeZod.safeParse(body);
  if (zodData.success === false) {
    // 提取所有错误消息，合并显示（最多显示前 3 个）
    const errorMessages = zodData.error.issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0);

    if (errorMessages.length > 0) {
      const message = errorMessages.length === 1 ? errorMessages[0] : errorMessages.join('; ');
      throw new Error(message);
    } else {
      throw new Error('Password validation failed');
    }
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
  } catch (_error) {
    return c.json(createResponse(null, 'Invalid refresh token', 401), 401);
  }
});

export default authRouter;
