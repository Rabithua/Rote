import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { ConfigTestResult, StorageConfig } from '../types/config';

/**
 * 配置测试工具类
 */
export class ConfigTester {
  /**
   * 判断是否需要使用路径风格访问
   * 路径风格是 S3 API 的标准格式，所有 S3 兼容服务都支持
   */
  private static shouldUsePathStyle(_endpoint: string): boolean {
    // 路径风格是标准格式，所有 S3 兼容服务都支持
    // 虚拟主机风格只是 AWS S3 的优化，但不是必需的
    return true;
  }

  /**
   * 测试存储配置（R2/S3）
   */
  public static async testStorage(config: StorageConfig): Promise<ConfigTestResult> {
    try {
      if (!config.endpoint || !config.bucket || !config.accessKeyId || !config.secretAccessKey) {
        return {
          success: false,
          message: 'Storage configuration is incomplete, please fill in all required fields',
        };
      }

      const s3Client = new S3Client({
        endpoint: config.endpoint,
        region: config.region || 'auto',
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        // 使用路径风格访问，兼容所有 S3 兼容服务（AWS S3、R2、Garage、MinIO 等）
        // 路径风格是 S3 API 的标准格式，所有服务商都支持
        forcePathStyle: this.shouldUsePathStyle(config.endpoint),
      });

      // 测试存储桶访问权限
      await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }));

      return {
        success: true,
        message: 'Storage configuration test successful',
        details: {
          endpoint: config.endpoint,
          bucket: config.bucket,
          urlPrefix: config.urlPrefix,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Storage configuration test failed: ${error.message}`,
        details: error,
      };
    }
  }

  /**
   * 测试数据库连接
   */
  public static async testDatabase(): Promise<ConfigTestResult> {
    try {
      const { db, closeDatabase } = await import('./drizzle');
      const { sql } = await import('drizzle-orm');

      // 执行简单查询测试连接
      await db.execute(sql`SELECT 1`);
      await closeDatabase();

      return {
        success: true,
        message: 'Database connection test successful',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Database connection test failed: ${error.message}`,
        details: error,
      };
    }
  }
}
