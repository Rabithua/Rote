import { and, eq } from 'drizzle-orm';
import { userOAuthBindings, users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 根据 OAuth 提供商和提供商 ID 查找用户
// 注意：现在只使用新的绑定表查找，不再使用 users 表中的 authProvider/authProviderId 字段
// 保留此函数用于向后兼容，但内部只使用绑定表
export async function findUserByOAuthId(
  authProvider: string,
  authProviderId: string
): Promise<any | null> {
  try {
    // 使用新的绑定表查找
    return await findUserByOAuthBinding(authProvider, authProviderId);
  } catch (error) {
    throw new DatabaseError(
      `Failed to find user by OAuth ID: ${authProvider}:${authProviderId}`,
      error
    );
  }
}

// 获取用户的所有 OAuth 绑定
export async function getUserOAuthBindings(userId: string): Promise<any[]> {
  try {
    const bindings = await db
      .select()
      .from(userOAuthBindings)
      .where(eq(userOAuthBindings.userid, userId));
    return bindings;
  } catch (error) {
    throw new DatabaseError(`Failed to get OAuth bindings for user: ${userId}`, error);
  }
}

// 绑定 OAuth 提供商
export async function bindOAuthProvider(
  userId: string,
  provider: string,
  providerId: string,
  providerUsername?: string
): Promise<any> {
  try {
    // 检查是否已经绑定
    const [existing] = await db
      .select()
      .from(userOAuthBindings)
      .where(and(eq(userOAuthBindings.userid, userId), eq(userOAuthBindings.provider, provider)))
      .limit(1);

    if (existing) {
      throw new DatabaseError(`User already has ${provider} OAuth binding`);
    }

    // 检查该 providerId 是否已被其他用户使用
    const [existingBinding] = await db
      .select()
      .from(userOAuthBindings)
      .where(
        and(eq(userOAuthBindings.provider, provider), eq(userOAuthBindings.providerId, providerId))
      )
      .limit(1);

    if (existingBinding) {
      throw new DatabaseError(`OAuth provider ID ${providerId} is already bound to another user`);
    }

    // 创建绑定
    const [binding] = await db
      .insert(userOAuthBindings)
      .values({
        userid: userId,
        provider,
        providerId,
        providerUsername: providerUsername || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return binding;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to bind OAuth provider: ${provider}`, error);
  }
}

// 解绑 OAuth 提供商
export async function unbindOAuthProvider(userId: string, provider: string): Promise<void> {
  try {
    const result = await db
      .delete(userOAuthBindings)
      .where(and(eq(userOAuthBindings.userid, userId), eq(userOAuthBindings.provider, provider)))
      .returning();

    if (result.length === 0) {
      throw new DatabaseError(`User does not have ${provider} OAuth binding`);
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to unbind OAuth provider: ${provider}`, error);
  }
}

// 根据 OAuth 提供商和提供商 ID 查找用户（使用新的绑定表）
export async function findUserByOAuthBinding(
  provider: string,
  providerId: string
): Promise<any | null> {
  try {
    const [binding] = await db
      .select({
        user: users,
      })
      .from(userOAuthBindings)
      .innerJoin(users, eq(userOAuthBindings.userid, users.id))
      .where(
        and(eq(userOAuthBindings.provider, provider), eq(userOAuthBindings.providerId, providerId))
      )
      .limit(1);

    return binding?.user || null;
  } catch (error) {
    throw new DatabaseError(
      `Failed to find user by OAuth binding: ${provider}:${providerId}`,
      error
    );
  }
}
