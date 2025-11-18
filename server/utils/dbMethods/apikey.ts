import { eq, sql } from 'drizzle-orm';
import { userOpenKeys } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// API密钥相关方法
export async function generateOpenKey(userid: string): Promise<any> {
  try {
    const [openKey] = await db
      .insert(userOpenKeys)
      .values({
        // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
        // 使用 sql`now()` 让数据库原子性地在同一时间点计算时间戳
        permissions: ['SENDROTE'],
        userid,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .returning();
    return openKey;
  } catch (error) {
    throw new DatabaseError('Failed to generate open key', error);
  }
}

export async function getMyOpenKey(userid: string): Promise<any> {
  try {
    const openKeys = await db.select().from(userOpenKeys).where(eq(userOpenKeys.userid, userid));
    return openKeys;
  } catch (error) {
    throw new DatabaseError('Failed to get user open keys', error);
  }
}

export async function deleteMyOneOpenKey(userid: string, id: string): Promise<any> {
  try {
    const [openKey] = await db.select().from(userOpenKeys).where(eq(userOpenKeys.id, id)).limit(1);

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to delete this open key');
    }

    const [result] = await db.delete(userOpenKeys).where(eq(userOpenKeys.id, id)).returning();
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to delete open key: ${id}`, error);
  }
}

export async function editMyOneOpenKey(
  userid: string,
  id: string,
  permissions: string[]
): Promise<any> {
  try {
    const [openKey] = await db.select().from(userOpenKeys).where(eq(userOpenKeys.id, id)).limit(1);

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to edit this open key');
    }

    const [result] = await db
      .update(userOpenKeys)
      .set({ permissions, updatedAt: new Date() })
      .where(eq(userOpenKeys.id, id))
      .returning();
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update open key: ${id}`, error);
  }
}

export async function getOneOpenKey(id: string): Promise<any> {
  try {
    const [openKey] = await db.select().from(userOpenKeys).where(eq(userOpenKeys.id, id)).limit(1);

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    return openKey;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get open key: ${id}`, error);
  }
}
