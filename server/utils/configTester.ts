import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { ConfigTestResult, StorageConfig } from '../types/config';

/**
 * 配置测试工具类
 */
export class ConfigTester {
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
        region: 'auto',
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
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
