import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn', (e) => {
  console.log('Prisma Warn:', e);
});

prisma.$on('info', (e) => {
  console.log('Prisma Info:', e);
});

prisma.$on('error', (e) => {
  // console.log("Prisma Error:", e);
});

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

      // 如果之前有连接尝试，先断开
      try {
        await prisma.$disconnect();
      } catch {
        // 忽略断开连接的错误
      }

      // 尝试连接
      await prisma.$connect();

      // 尝试执行一个简单的查询来验证连接
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Prisma connected successfully!');
      return;
    } catch (error: any) {
      // 确保在错误时断开连接
      try {
        await prisma.$disconnect();
      } catch {
        // 忽略断开连接的错误
      }

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

export default prisma;
