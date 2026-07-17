import { drizzle } from 'drizzle-orm/postgres-js';
import { existsSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';
import * as oauthMcpSchema from '../drizzle/oauthMcpSchema';
import * as baseSchema from '../drizzle/schema';

const schema = { ...baseSchema, ...oauthMcpSchema };

// 创建 postgres 连接
const connectionString = process.env.POSTGRESQL_URL || '';

if (!connectionString) {
  throw new Error('POSTGRESQL_URL environment variable is not set');
}

// 创建 postgres 客户端（用于查询）
const queryClient = postgres(connectionString, {
  max: 10, // 连接池大小
  idle_timeout: 20,
  connect_timeout: 10,
});

// 创建 Drizzle 实例（同时支持 SQL-like API 和 Relational Query API）
export const db = drizzle(queryClient, { schema });

export type DatabaseAdvisoryLockResult<T> = { acquired: false } | { acquired: true; result: T };

export async function withDatabaseAdvisoryLock<T>(
  lockName: string,
  task: () => Promise<T>
): Promise<DatabaseAdvisoryLockResult<T>> {
  const connection = await queryClient.reserve();
  let acquired = false;
  try {
    const rows = await connection`
      SELECT pg_try_advisory_lock(hashtext(${lockName})) AS acquired
    `;
    acquired = rows[0]?.acquired === true;
    if (!acquired) return { acquired: false };
    return { acquired: true, result: await task() };
  } finally {
    try {
      if (acquired) {
        await connection`
          SELECT pg_advisory_unlock(hashtext(${lockName}))
        `;
      }
    } finally {
      connection.release();
    }
  }
}

// 为了兼容性，默认导出
export default db;

/**
 * 等待数据库连接就绪，带重试机制
 * @param maxRetries 最大重试次数，默认 30 次
 * @param retryDelay 重试延迟（毫秒），默认 2 秒
 */
export async function waitForDatabase(
  maxRetries: number = 30,
  retryDelay: number = 2000
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempting to connect to database (${attempt}/${maxRetries})...`);

      // 尝试执行一个简单的查询来验证连接
      await queryClient`SELECT 1`;
      console.log('✅ Drizzle connected successfully!');
      return;
    } catch (error: any) {
      if (attempt === maxRetries) {
        console.error('❌ Failed to connect to database after all retries:', error);
        throw new Error(
          `Database connection failed after ${maxRetries} attempts. Please check your database configuration. Error: ${error?.message || error}`
        );
      }
      console.log(
        `⏳ Database not ready yet, retrying in ${retryDelay / 1000}s... (${attempt}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * 运行数据库迁移
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');

    // 使用绝对路径，基于当前工作目录
    const cwd = process.cwd();
    const migrationsFolder = join(cwd, 'drizzle', 'migrations');

    // 检查迁移文件夹是否存在
    if (!existsSync(migrationsFolder)) {
      const errorMsg = `❌ Migration folder does not exist: ${migrationsFolder}`;
      console.error(errorMsg);
      console.error(
        '💡 This usually means migrations were not copied correctly during Docker build.'
      );
      throw new Error(errorMsg);
    }

    // 检查迁移文件是否存在
    const metaFile = join(migrationsFolder, 'meta', '_journal.json');
    if (!existsSync(metaFile)) {
      const errorMsg = `❌ Migration metadata file not found: ${metaFile}`;
      console.error(errorMsg);
      console.error(
        '💡 This usually means migrations were not copied correctly during Docker build.'
      );
      throw new Error(errorMsg);
    }

    console.log('✅ Migration files found, proceeding with migration...');

    await migrate(db, { migrationsFolder });
    console.log('✅ Database migrations completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error);

    // 提供详细的错误信息
    const errorMessage = error?.message || 'Unknown migration error';
    const errorCode = error?.code;

    // 检查是否是文件路径问题
    if (
      errorMessage.includes('ENOENT') ||
      errorMessage.includes('no such file') ||
      errorMessage.includes('does not exist')
    ) {
      console.error(
        '❌ Migration folder not found. Please verify that drizzle/migrations directory exists.'
      );
      throw new Error(
        `Migration folder not found. This may indicate that migrations were not copied correctly during build. Error: ${errorMessage}`
      );
    }

    // 检查是否是数据库连接问题
    if (
      errorCode === '28P01' ||
      errorCode === '08006' ||
      errorMessage.includes('password') ||
      errorMessage.includes('connection')
    ) {
      console.error('❌ Database connection error during migration.');
      throw new Error(
        `Database connection failed during migration. Please check database credentials. Error: ${errorMessage}`
      );
    }

    // 检查是否是 SQL 语法错误
    if (errorCode === '42601' || errorMessage.includes('syntax error')) {
      console.error('❌ SQL syntax error in migration file.');
      throw new Error(
        `SQL syntax error in migration file. Please check migration files. Error: ${errorMessage}`
      );
    }

    throw error;
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  await queryClient.end();
}
