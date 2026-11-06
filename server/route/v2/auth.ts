import crypto from 'crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import type { User } from '../../drizzle/schema';
import { requireSecurityConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import db from '../../utils/drizzle';
import { changeUserPassword, oneUser, passportCheckUser } from '../../utils/dbMethods';
import { UserIdentityConflict } from '../../utils/dbMethods/user';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { createResponse, sanitizeUserData } from '../../utils/main';
import { passwordChangeZod, RegisterDataZod } from '../../utils/zod';
import {
  clearUserPassword,
  PasswordCredentialError,
} from '../../authentication/passwordCredentials';
import { LastLoginMethodError } from '../../authentication/loginMethods';
import { AuthenticationPolicyError } from '../../authentication/policy';
import { registerPasswordAccount } from '../../authentication/passwordRegistration';
import oauthRegistrationRouter from './authOAuthRegistration';
import passkeyRegistrationRouter from './authPasskeyRegistration';

// 认证相关路由
const authRouter = new Hono<{ Variables: HonoVariables }>();

// 注册
authRouter.post('/register', async (c: HonoContext) => {
  const parsed = RegisterDataZod.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      {
        ...createResponse(null, parsed.error.issues[0].message, 400),
        errorCode: parsed.error.issues.some((issue) => issue.path[0] === 'username')
          ? 'username_invalid'
          : 'registration_invalid',
      },
      400
    );
  }
  let user: User;
  try {
    user = await registerPasswordAccount(parsed.data);
  } catch (error) {
    if (error instanceof AuthenticationPolicyError) {
      return c.json(
        { ...createResponse(null, error.message, error.status), errorCode: error.code },
        error.status
      );
    }
    if (error instanceof UserIdentityConflict) {
      return c.json(
        {
          ...createResponse(null, error.message, 409),
          errorCode: error.identity === 'username' ? 'username_unavailable' : 'email_unavailable',
        },
        409
      );
    }
    throw error;
  }

  if (!user.id) {
    throw new Error('Registration failed, username or email already exists');
  }

  // Generate JWT tokens so the user is immediately logged in (supports passkey registration during signup)
  const accessToken = await generateAccessToken({
    userId: user.id,
    username: user.username,
  });
  const refreshToken = await generateRefreshToken({
    userId: user.id,
    username: user.username,
  });

  const sanitizedUser = sanitizeUserData(user);
  return c.json(
    createResponse(
      {
        user: sanitizedUser,
        accessToken,
        refreshToken,
      },
      'Registration successful'
    ),
    201
  );
});

authRouter.route('/register/passkey', passkeyRegistrationRouter);
authRouter.route('/register/oauth', oauthRegistrationRouter);

// 登录 (手动实现，不再使用 Passport)
authRouter.post('/login', requireSecurityConfig, async (c: HonoContext) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (!username || !password) {
    throw new Error('Username or email and password are required');
  }

  // 查找用户（支持用户名或邮箱）
  const { user, err } = await passportCheckUser({ usernameOrEmail: username });
  if (err || !user) {
    throw new Error('User not found.');
  }

  // 检查用户是否有密码（只要有密码，无论 authProvider 是什么，都允许密码登录）
  // 这样支持账号密码用户绑定 GitHub 后仍可用密码登录
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
            return reject(new Error('Incorrect username/email or password.'));
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
                // Preserve the published native password-login response contract.
                user: { ...sanitizeUserData(user as User), email: user.email ?? '' },
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

  // 检查用户是否有密码（只有有密码的用户才能修改密码）
  const fullUser = await oneUser(user.id);
  if (!fullUser) {
    throw new Error('User not found');
  }
  if (!fullUser.passwordhash || !fullUser.salt) {
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
  const sanitizedUser = sanitizeUserData(updatedUser);
  return c.json(createResponse(sanitizedUser), 200);
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

// Credential removals share an owner lock so concurrent removals cannot lock out an account.
authRouter.delete('/password', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const { password } = await c.req.json().catch(() => ({}));
  try {
    const updatedUser = await clearUserPassword(user.id, password);
    return c.json(createResponse({ ...sanitizeUserData(updatedUser), hasPassword: false }), 200);
  } catch (error) {
    if (error instanceof LastLoginMethodError || error instanceof PasswordCredentialError) {
      return c.json(createResponse(null, error.message, 400), 400);
    }
    throw error;
  }
});

// 设置密码 (适用于无密码账户设置密码)
authRouter.post('/password/set', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json().catch(() => ({}));
  const { newpassword } = body;

  // 1. 获取完整用户信息
  const fullUser = await oneUser(user.id);
  if (!fullUser) {
    return c.json(createResponse(null, 'User not found', 404), 404);
  }

  // 2. 检查当前是否已经有密码
  if (fullUser.passwordhash && fullUser.salt) {
    return c.json(
      createResponse(
        null,
        'Account already has a password. Please use change password endpoint instead.',
        400
      ),
      400
    );
  }

  // 3. 验证新密码强度/格式
  const zodData = passwordChangeZod.safeParse({ newpassword, oldpassword: 'placeholder_not_used' });
  if (zodData.success === false) {
    const errorMessages = zodData.error.issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0);

    const message =
      errorMessages.length === 1
        ? errorMessages[0]
        : errorMessages.join('; ') || 'Password validation failed';
    return c.json(createResponse(null, message, 400), 400);
  }

  // 4. 生成 hash 并更新数据库
  const salt = crypto.randomBytes(16);
  const passwordhash = crypto.pbkdf2Sync(newpassword, salt, 310000, 32, 'sha256');

  await db
    .update(users)
    .set({
      passwordhash,
      salt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // 获取更新后的用户信息并返回
  const updatedUser = await oneUser(user.id);
  if (!updatedUser) {
    return c.json(createResponse(null, 'User not found after update', 404), 404);
  }

  const sanitizedUser = sanitizeUserData(updatedUser);
  const profileResponse = {
    ...sanitizedUser,
    hasPassword: true,
  };

  return c.json(createResponse(profileResponse, 'Password set successfully'), 200);
});

export default authRouter;
