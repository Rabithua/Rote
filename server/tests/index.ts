/**
 * 主测试运行器
 * 完整的测试流程：登录 -> 测试所有接口 -> 登出
 */

import { eq, or } from 'drizzle-orm';
import { settings, users } from '../drizzle/schema';
import testConfig from '../scripts/testConfig.json';
import { generateSecurityKeys } from '../utils/config';
import db, { closeDatabase } from '../utils/drizzle';
import { ApiKeyTestSuite } from './apikey.test';
import { AttachmentTestSuite } from './attachment.test';
import { AuthTestSuite } from './auth.test';
import { ChangeTestSuite } from './change.test';
import { NoteTestSuite } from './note.test';
import { ReactionTestSuite } from './reaction.test';
import { SiteTestSuite } from './site.test';
import { SubscriptionTestSuite } from './subscription.test';
import { UserTestSuite } from './user.test';
import { TestResultManager } from './utils/testResult';

const BASE_URL = process.env.TEST_BASE_URL || testConfig.testSettings.baseUrl;
const API_BASE = `${BASE_URL}${testConfig.testSettings.apiBase}/api`;

// 默认测试账号
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'password';

class TestRunner {
  private resultManager: TestResultManager;
  private authSuite: AuthTestSuite;
  private noteSuite: NoteTestSuite | null = null;
  private userSuite: UserTestSuite | null = null;
  private apiKeySuite: ApiKeyTestSuite | null = null;
  private reactionSuite: ReactionTestSuite | null = null;
  private changeSuite: ChangeTestSuite | null = null;
  private subscriptionSuite: SubscriptionTestSuite | null = null;
  private siteSuite: SiteTestSuite | null = null;
  private attachmentSuite: AttachmentTestSuite | null = null;
  private authToken: string | null = null;

  constructor() {
    this.resultManager = new TestResultManager();
    this.authSuite = new AuthTestSuite(API_BASE, this.resultManager);
  }

  /**
   * 清理测试数据
   */
  async cleanupDatabase() {
    const startTime = Date.now();
    try {
      // 删除所有配置
      await db.delete(settings);

      // 只删除测试用户（保留 admin 用户用于测试）
      const testUsers = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.username, 'testadmin'),
            eq(users.email, 'testadmin@test.com'),
            eq(users.email, 'admin@test.com')
          )
        );

      if (testUsers.length > 0) {
        await db
          .delete(users)
          .where(
            or(
              eq(users.username, 'testadmin'),
              eq(users.email, 'testadmin@test.com'),
              eq(users.email, 'admin@test.com')
            )
          );
      }

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Database Cleanup', true, 'Test data cleaned up', duration);
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Database Cleanup',
        false,
        'Failed to clean database',
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests(username: string = DEFAULT_USERNAME, password: string = DEFAULT_PASSWORD) {
    console.log('🚀 开始完整 API 测试流程\n');
    console.log(`测试目标: ${API_BASE}`);
    console.log(`测试账号: ${username}\n`);

    try {
      // 1. 清理数据库
      await this.cleanupDatabase();

      // 2. 检查系统状态并确保安全配置
      console.log('='.repeat(80));
      console.log('🔧 步骤 0: 检查系统配置');
      console.log('='.repeat(80));

      // 检查系统是否已初始化
      const statusResponse = await this.authSuite.getClient().get('/admin/status');
      const isInitialized = statusResponse.data.data?.isInitialized;

      if (!isInitialized) {
        console.log('⚠️  系统未初始化，尝试初始化系统...');
        // 尝试初始化系统（如果可能）
        const initResponse = await this.authSuite.getClient().post('/admin/setup', {
          site: testConfig.testData.site,
          storage: {
            endpoint: 'https://9a7e130cdaa8a057ae7869e2f7782d54.r2.cloudflarestorage.com',
            bucket: 'rotedev',
            accessKeyId: '58c216a1ad52886a161ecf543eb1ff77',
            secretAccessKey: '7efffa7524a3a189d47d59a924841ab4f84022391247a0f42d998ae1bc3067d3',
            urlPrefix: 'https://r2dev.rote.ink',
          },
          ui: testConfig.testData.ui,
          admin: testConfig.testData.admin,
        });

        if (initResponse.status === 200) {
          console.log('✅ 系统初始化成功');
        } else if (
          initResponse.status === 400 &&
          initResponse.data.message?.includes('already exists')
        ) {
          console.log('⚠️  管理员用户已存在，检查安全配置...');
          // 检查安全配置是否存在
          const securityConfig = await db
            .select()
            .from(settings)
            .where(eq(settings.group, 'security'))
            .limit(1);

          if (securityConfig.length === 0 || !securityConfig[0].config) {
            console.log('🔑 安全配置缺失，正在生成安全密钥...');
            try {
              // 先检查是否已经有配置记录（即使 config 为空）
              const existingSecurity = await db
                .select()
                .from(settings)
                .where(eq(settings.group, 'security'))
                .limit(1);
              const existingNotification = await db
                .select()
                .from(settings)
                .where(eq(settings.group, 'notification'))
                .limit(1);

              const { KeyGenerator } = await import('../utils/keyGenerator');
              const jwtSecret = KeyGenerator.generateJWTSecret();
              const jwtRefreshSecret = KeyGenerator.generateJWTSecret();
              const sessionSecret = KeyGenerator.generateSessionSecret();
              const vapidKeys = KeyGenerator.generateVAPIDKeys();

              // 直接使用 update 或 insert，避免 UUID 问题
              if (existingSecurity.length > 0) {
                await db
                  .update(settings)
                  .set({
                    config: {
                      jwtSecret,
                      jwtRefreshSecret,
                      jwtAccessExpiry: '15m',
                      jwtRefreshExpiry: '7d',
                      sessionSecret,
                    } as any,
                    isRequired: true,
                    isInitialized: true,
                    updatedAt: new Date(),
                  })
                  .where(eq(settings.group, 'security'));
                console.log('✅ 安全配置已更新');
              } else {
                // 使用 sql 模板插入，让数据库生成 UUID
                const { sql } = await import('drizzle-orm');
                await db.execute(sql`
                  INSERT INTO settings (id, "group", config, "isRequired", "isInitialized", "isSystem", "createdAt", "updatedAt")
                  VALUES (gen_random_uuid(), 'security', ${JSON.stringify({
                    jwtSecret,
                    jwtRefreshSecret,
                    jwtAccessExpiry: '15m',
                    jwtRefreshExpiry: '7d',
                    sessionSecret,
                  })}::jsonb, true, true, false, NOW(), NOW())
                `);
                console.log('✅ 安全配置已创建');
              }

              if (existingNotification.length > 0) {
                await db
                  .update(settings)
                  .set({
                    config: {
                      vapidPublicKey: vapidKeys.publicKey,
                      vapidPrivateKey: vapidKeys.privateKey,
                    } as any,
                    updatedAt: new Date(),
                  })
                  .where(eq(settings.group, 'notification'));
              } else {
                const { sql } = await import('drizzle-orm');
                await db.execute(sql`
                  INSERT INTO settings (id, "group", config, "isRequired", "isInitialized", "isSystem", "createdAt", "updatedAt")
                  VALUES (gen_random_uuid(), 'notification', ${JSON.stringify({
                    vapidPublicKey: vapidKeys.publicKey,
                    vapidPrivateKey: vapidKeys.privateKey,
                  })}::jsonb, false, true, false, NOW(), NOW())
                `);
              }

              console.log('✅ 安全密钥配置完成');
              // 等待配置缓存刷新
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // 尝试刷新配置缓存（可能失败，但不影响）
              try {
                await this.authSuite.getClient().post('/admin/refresh-cache');
              } catch {
                // 忽略刷新缓存错误
              }
            } catch (error: any) {
              console.log(`⚠️  配置安全密钥时出错: ${error.message}`);
              // 如果还是失败，尝试使用 generateSecurityKeys
              try {
                const success = await generateSecurityKeys();
                if (!success) {
                  console.log('❌ 所有安全密钥生成方法都失败了');
                }
              } catch (fallbackError: any) {
                console.log(`⚠️  备用方法也失败: ${fallbackError.message}`);
              }
            }
          } else {
            console.log('✅ 安全配置已存在');
          }
        }
      }

      // 3. 登录
      console.log('\n' + '='.repeat(80));
      console.log('📝 步骤 1: 用户认证');
      console.log('='.repeat(80));
      this.authToken = await this.authSuite.testLogin(username, password);
      if (!this.authToken) {
        console.error('❌ 登录失败。可能的原因：');
        console.error('   1. 安全配置未完成（需要运行系统初始化）');
        console.error('   2. 用户名或密码错误');
        console.error('   3. 用户不存在');
        throw new Error('登录失败，无法继续测试。请确保系统已正确初始化。');
      }

      const client = this.authSuite.getClient();

      // 3. 初始化各个测试套件
      this.noteSuite = new NoteTestSuite(client, this.resultManager);
      this.userSuite = new UserTestSuite(client, this.resultManager);
      this.apiKeySuite = new ApiKeyTestSuite(client, this.resultManager);
      this.reactionSuite = new ReactionTestSuite(client, this.resultManager);
      this.changeSuite = new ChangeTestSuite(client, this.resultManager);
      this.subscriptionSuite = new SubscriptionTestSuite(client, this.resultManager);
      this.siteSuite = new SiteTestSuite(client, this.resultManager);
      this.attachmentSuite = new AttachmentTestSuite(client, this.resultManager);

      // 4. 测试用户相关接口
      console.log('\n' + '='.repeat(80));
      console.log('👤 步骤 2: 用户相关接口测试');
      console.log('='.repeat(80));
      await this.userSuite.testGetMyProfile();
      await this.userSuite.testGetUserInfo(username);
      await this.userSuite.testGetMyTags();
      await this.userSuite.testGetStatistics();

      // 测试更新个人资料
      const originalProfile = await this.userSuite.testGetMyProfile();
      if (originalProfile) {
        // 获取原始昵称（可能是 user 字段或直接是用户数据）
        const originalNickname =
          originalProfile.user?.nickname || originalProfile.nickname || 'Administrator';

        await this.userSuite.testUpdateProfile({
          nickname: 'Test User Updated',
        });
        // 恢复原始昵称
        await this.userSuite.testUpdateProfile({
          nickname: originalNickname,
        });
      }

      // 5. 测试笔记相关接口
      console.log('\n' + '='.repeat(80));
      console.log('📝 步骤 3: 笔记相关接口测试');
      console.log('='.repeat(80));

      // 创建笔记
      const note1 = await this.noteSuite.testCreateNote('这是第一条测试笔记', '测试标题1', [
        '测试',
        '笔记',
      ]);
      const note2 = await this.noteSuite.testCreateNote('这是第二条测试笔记', '测试标题2', [
        '测试',
      ]);

      // 获取笔记
      if (note1?.id) {
        await this.noteSuite.testGetNote(note1.id);
      }

      // 更新笔记
      if (note1?.id) {
        await this.noteSuite.testUpdateNote(note1.id, {
          content: '这是更新后的笔记内容',
          title: '更新后的标题',
        });
      }

      // 搜索笔记
      await this.noteSuite.testSearchNotes('测试');
      await this.noteSuite.testSearchNotes(undefined, '测试');

      // 获取随机笔记
      await this.noteSuite.testGetRandomNote();

      // 6. 测试 API Key 相关接口
      console.log('\n' + '='.repeat(80));
      console.log('🔑 步骤 4: API Key 相关接口测试');
      console.log('='.repeat(80));

      const apiKey1 = await this.apiKeySuite.testGenerateApiKey();
      const apiKey2 = await this.apiKeySuite.testGenerateApiKey();

      await this.apiKeySuite.testGetApiKeys();

      if (apiKey1?.id) {
        await this.apiKeySuite.testUpdateApiKey(apiKey1.id, {
          name: 'Updated API Key Name',
        });
      }

      // 7. 测试反应相关接口
      console.log('\n' + '='.repeat(80));
      console.log('👍 步骤 5: 反应相关接口测试');
      console.log('='.repeat(80));

      // 使用现有的笔记 ID 进行反应测试
      if (this.reactionSuite) {
        // 从随机笔记获取一个笔记 ID
        const randomNote = await this.noteSuite?.testGetRandomNote();
        if (randomNote?.id) {
          await this.reactionSuite.testAddReaction(randomNote.id, 'like');
          await this.reactionSuite.testAddReaction(randomNote.id, 'heart');
          await this.reactionSuite.testRemoveReaction(randomNote.id, 'like');
        }
      }

      // 8. 测试变更记录相关接口
      console.log('\n' + '='.repeat(80));
      console.log('📋 步骤 6: 变更记录相关接口测试');
      console.log('='.repeat(80));

      if (this.changeSuite) {
        await this.changeSuite.testGetChangesByUserId(0, 10);
        // 从变更记录中获取一个笔记 ID 进行测试
        const changes = await this.changeSuite.testGetChangesByUserId(0, 1);
        if (changes && Array.isArray(changes) && changes.length > 0 && changes[0].roteid) {
          await this.changeSuite.testGetChangesByRoteId(changes[0].roteid, 0, 10);
        }
        // 测试获取时间戳之后的变更
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await this.changeSuite.testGetChangesAfterTimestamp(yesterday.toISOString(), 0, 10);
      }

      // 9. 测试站点相关接口
      console.log('\n' + '='.repeat(80));
      console.log('🌐 步骤 7: 站点相关接口测试');
      console.log('='.repeat(80));

      if (this.siteSuite) {
        await this.siteSuite.testGetSiteStatus();
        await this.siteSuite.testGetConfigStatus();
        await this.siteSuite.testGetSitemap();
      }

      // 10. 测试订阅相关接口（可选，需要配置 VAPID）
      console.log('\n' + '='.repeat(80));
      console.log('🔔 步骤 8: 订阅相关接口测试');
      console.log('='.repeat(80));

      if (this.subscriptionSuite) {
        // 创建测试订阅数据
        const testSubscription = {
          endpoint: 'https://test.endpoint.com',
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key',
          },
        };

        const subscription = await this.subscriptionSuite.testAddSubscription(testSubscription);
        await this.subscriptionSuite.testGetSubscriptions();

        if (subscription?.id) {
          await this.subscriptionSuite.testUpdateSubscription(subscription.id, {
            status: 'active',
          });
        }
      }

      // 11. 测试附件相关接口（需要存储配置）
      console.log('\n' + '='.repeat(80));
      console.log('📎 步骤 9: 附件相关接口测试');
      console.log('='.repeat(80));

      if (this.attachmentSuite) {
        // 测试预签名上传（需要有效的存储配置）
        try {
          const presignResult = await this.attachmentSuite.testPresignUpload([
            {
              filename: 'test.jpg',
              contentType: 'image/jpeg',
              size: 1024,
            },
          ]);
          // 如果成功，可以测试完成上传（但需要实际上传文件，这里跳过）
        } catch (error: any) {
          // 如果存储未配置，这是预期的
          if (error.message?.includes('storage') || error.message?.includes('Storage')) {
            console.log('⚠️  附件测试跳过（存储未配置）');
          } else {
            throw error;
          }
        }
      }

      // 12. 测试认证相关接口（刷新令牌等）
      console.log('\n' + '='.repeat(80));
      console.log('🔐 步骤 10: 认证相关接口测试');
      console.log('='.repeat(80));

      // 注意：这里需要从登录响应中获取 refreshToken
      // 为了简化，我们跳过刷新令牌测试，因为需要保存 refreshToken

      // 13. 测试错误场景
      console.log('\n' + '='.repeat(80));
      console.log('⚠️  步骤 11: 错误场景测试');
      console.log('='.repeat(80));
      await this.authSuite.testErrorScenarios();

      // 14. 清理测试数据
      console.log('\n' + '='.repeat(80));
      console.log('🧹 步骤 12: 清理测试数据');
      console.log('='.repeat(80));

      if (this.noteSuite) {
        await this.noteSuite.cleanup();
      }

      if (this.apiKeySuite) {
        await this.apiKeySuite.cleanup();
      }

      if (this.reactionSuite) {
        await this.reactionSuite.cleanup();
      }

      if (this.subscriptionSuite) {
        await this.subscriptionSuite.cleanup();
      }

      if (this.attachmentSuite) {
        await this.attachmentSuite.cleanup();
      }

      // 15. 显示测试摘要
      this.resultManager.showSummary();

      const allPassed = this.resultManager.allPassed();
      if (allPassed) {
        console.log('\n🎉 所有测试通过！');
        return true;
      } else {
        console.log('\n⚠️  部分测试失败，请检查上述输出');
        return false;
      }
    } catch (error: any) {
      console.error('\n❌ 测试执行失败:', error);
      this.resultManager.showSummary();
      return false;
    } finally {
      // 清除认证令牌（模拟登出）
      if (this.authSuite) {
        this.authSuite.getClient().clearAuthToken();
      }
      await closeDatabase();
    }
  }
}

// 运行测试
if (require.main === module) {
  const runner = new TestRunner();
  const username = process.env.TEST_USERNAME || DEFAULT_USERNAME;
  const password = process.env.TEST_PASSWORD || DEFAULT_PASSWORD;

  runner
    .runAllTests(username, password)
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('测试运行器错误:', error);
      process.exit(1);
    });
}

export { TestRunner };
