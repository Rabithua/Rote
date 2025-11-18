/**
 * 程序化运行数据库迁移
 * 使用 drizzle-orm 的 migrate 函数，不依赖 drizzle-kit CLI
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

const connectionString = process.env.POSTGRESQL_URL || '';

if (!connectionString) {
  console.error('❌ POSTGRESQL_URL environment variable is not set');
  process.exit(1);
}

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');
    console.log(`📝 Database URL: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

    // 创建 postgres 客户端
    const queryClient = postgres(connectionString, {
      max: 1, // 迁移时只需要一个连接
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // 创建 Drizzle 实例
    const db = drizzle(queryClient, { schema });

    // 运行迁移
    await migrate(db, { migrationsFolder: './drizzle/migrations' });

    console.log('✅ Database migrations completed successfully!');

    // 关闭连接
    await queryClient.end();
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
