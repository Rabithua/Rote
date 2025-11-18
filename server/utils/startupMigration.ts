import { sql } from 'drizzle-orm';
import { configManager } from './config';
import db from './drizzle';

/**
 * 启动时配置检查工具
 */
export class StartupMigration {
  /**
   * 检查系统启动状态
   */
  public static async checkStartupStatus(): Promise<void> {
    try {
      console.log('🔧 Checking system startup status...');

      // 检查数据库连接
      const dbConnected = await this.checkDatabaseConnection();
      if (!dbConnected) {
        console.error('❌ Database connection failed');
        console.log('📝 Please check your DATABASE_URL environment variable');
        return;
      }

      // 检查系统是否已初始化
      const isInitialized = await configManager.isSystemInitialized();

      if (isInitialized) {
        console.log('✅ System is initialized and ready');
        return;
      }

      console.log('⚠️  System not initialized');
      console.log('🚀 Please complete the initialization via the admin panel');
    } catch (error) {
      console.error('❌ Startup check failed:', error);
      console.log('📝 Please check your configuration and try again');
    }
  }

  /**
   * 检查数据库连接
   */
  private static async checkDatabaseConnection(): Promise<boolean> {
    try {
      await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      return false;
    }
  }

  /**
   * 显示当前配置状态
   */
  public static async showConfigStatus(): Promise<void> {
    try {
      const isInitialized = await configManager.isSystemInitialized();
      const missingConfigs = await configManager.getMissingRequiredConfigs();

      console.log('\n📊 System Status:');
      console.log(`   Database: ✅ Connected`);
      console.log(`   Initialized: ${isInitialized ? '✅ Yes' : '❌ No'}`);
      console.log(
        `   Missing configs: ${missingConfigs.length > 0 ? missingConfigs.join(', ') : 'None'}`
      );

      if (!isInitialized) {
        console.log('\n🚀 Next steps:');
        console.log('   1. Visit /admin/setup to complete initialization');
        console.log('   2. Configure your site, storage, and admin account');
      } else {
        console.log('\n🎉 System is ready for use!');
      }
    } catch (error) {
      console.error('❌ Failed to check configuration status:', error);
    }
  }
}
