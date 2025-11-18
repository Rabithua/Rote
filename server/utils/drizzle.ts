import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

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
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('✅ Database migrations completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  await queryClient.end();
}
