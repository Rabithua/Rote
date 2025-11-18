/**
 * 测试 UUID 自动生成功能
 * 用于验证 schema.ts 中 defaultRandom() 是否正常工作
 */

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { attachments, reactions, rotes, userSettings, users } from '../drizzle/schema';
import db, { closeDatabase, waitForDatabase } from '../utils/drizzle';

interface TestResult {
  table: string;
  success: boolean;
  hasId: boolean;
  id?: string;
  error?: string;
}

class UuidGenerationTester {
  private results: TestResult[] = [];

  /**
   * 测试用户表插入
   */
  async testUsersTable(): Promise<TestResult> {
    try {
      const salt = crypto.randomBytes(16);
      const passwordhash = crypto.pbkdf2Sync('testpassword', salt, 310000, 32, 'sha256');

      const testUsername = `test_user_${Date.now()}`;
      const testEmail = `test_${Date.now()}@test.com`;

      const [user] = await db
        .insert(users)
        .values({
          username: testUsername,
          email: testEmail,
          passwordhash,
          salt,
        })
        .returning();

      const hasId = !!user?.id;
      const result: TestResult = {
        table: 'users',
        success: hasId,
        hasId,
        id: user?.id,
      };

      if (hasId) {
        // 清理测试数据
        await db.delete(users).where(eq(users.id, user.id));
      }

      return result;
    } catch (error: any) {
      return {
        table: 'users',
        success: false,
        hasId: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 测试笔记表插入
   */
  async testRotesTable(): Promise<TestResult> {
    try {
      // 先创建一个测试用户
      const salt = crypto.randomBytes(16);
      const passwordhash = crypto.pbkdf2Sync('testpassword', salt, 310000, 32, 'sha256');
      const testUsername = `test_author_${Date.now()}`;
      const testEmail = `test_author_${Date.now()}@test.com`;

      const [author] = await db
        .insert(users)
        .values({
          username: testUsername,
          email: testEmail,
          passwordhash,
          salt,
        })
        .returning();

      if (!author?.id) {
        return {
          table: 'rotes',
          success: false,
          hasId: false,
          error: 'Failed to create test author',
        };
      }

      // 测试插入笔记
      const [rote] = await db
        .insert(rotes)
        .values({
          content: 'Test content',
          authorid: author.id,
        })
        .returning();

      const hasId = !!rote?.id;
      const result: TestResult = {
        table: 'rotes',
        success: hasId,
        hasId,
        id: rote?.id,
      };

      // 清理测试数据
      if (rote?.id) {
        await db.delete(rotes).where(eq(rotes.id, rote.id));
      }
      await db.delete(users).where(eq(users.id, author.id));

      return result;
    } catch (error: any) {
      return {
        table: 'rotes',
        success: false,
        hasId: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 测试附件表插入
   */
  async testAttachmentsTable(): Promise<TestResult> {
    try {
      // 先创建一个测试用户
      const salt = crypto.randomBytes(16);
      const passwordhash = crypto.pbkdf2Sync('testpassword', salt, 310000, 32, 'sha256');
      const testUsername = `test_user_${Date.now()}`;
      const testEmail = `test_${Date.now()}@test.com`;

      const [author] = await db
        .insert(users)
        .values({
          username: testUsername,
          email: testEmail,
          passwordhash,
          salt,
        })
        .returning();

      if (!author?.id) {
        return {
          table: 'attachments',
          success: false,
          hasId: false,
          error: 'Failed to create test user',
        };
      }

      // 测试插入附件
      const [attachment] = await db
        .insert(attachments)
        .values({
          url: 'https://test.com/image.jpg',
          storage: 'R2',
          details: { key: 'test-key' },
          userid: author.id,
        })
        .returning();

      const hasId = !!attachment?.id;
      const result: TestResult = {
        table: 'attachments',
        success: hasId,
        hasId,
        id: attachment?.id,
      };

      // 清理测试数据
      if (attachment?.id) {
        await db.delete(attachments).where(eq(attachments.id, attachment.id));
      }
      await db.delete(users).where(eq(users.id, author.id));

      return result;
    } catch (error: any) {
      return {
        table: 'attachments',
        success: false,
        hasId: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 测试反应表插入
   */
  async testReactionsTable(): Promise<TestResult> {
    try {
      // 先创建测试用户和笔记
      const salt = crypto.randomBytes(16);
      const passwordhash = crypto.pbkdf2Sync('testpassword', salt, 310000, 32, 'sha256');
      const testUsername = `test_user_${Date.now()}`;
      const testEmail = `test_${Date.now()}@test.com`;

      const [author] = await db
        .insert(users)
        .values({
          username: testUsername,
          email: testEmail,
          passwordhash,
          salt,
        })
        .returning();

      if (!author?.id) {
        return {
          table: 'reactions',
          success: false,
          hasId: false,
          error: 'Failed to create test author',
        };
      }

      const [rote] = await db
        .insert(rotes)
        .values({
          content: 'Test content',
          authorid: author.id,
        })
        .returning();

      if (!rote?.id) {
        await db.delete(users).where(eq(users.id, author.id));
        return {
          table: 'reactions',
          success: false,
          hasId: false,
          error: 'Failed to create test rote',
        };
      }

      // 测试插入反应
      const [reaction] = await db
        .insert(reactions)
        .values({
          type: 'like',
          roteid: rote.id,
        })
        .returning();

      const hasId = !!reaction?.id;
      const result: TestResult = {
        table: 'reactions',
        success: hasId,
        hasId,
        id: reaction?.id,
      };

      // 清理测试数据
      if (reaction?.id) {
        await db.delete(reactions).where(eq(reactions.id, reaction.id));
      }
      await db.delete(rotes).where(eq(rotes.id, rote.id));
      await db.delete(users).where(eq(users.id, author.id));

      return result;
    } catch (error: any) {
      return {
        table: 'reactions',
        success: false,
        hasId: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 测试用户设置表插入
   */
  async testUserSettingsTable(): Promise<TestResult> {
    try {
      // 先创建测试用户
      const salt = crypto.randomBytes(16);
      const passwordhash = crypto.pbkdf2Sync('testpassword', salt, 310000, 32, 'sha256');
      const testUsername = `test_user_${Date.now()}`;
      const testEmail = `test_${Date.now()}@test.com`;

      const [author] = await db
        .insert(users)
        .values({
          username: testUsername,
          email: testEmail,
          passwordhash,
          salt,
        })
        .returning();

      if (!author?.id) {
        return {
          table: 'user_settings',
          success: false,
          hasId: false,
          error: 'Failed to create test user',
        };
      }

      // 测试插入用户设置
      const [setting] = await db
        .insert(userSettings)
        .values({
          userid: author.id,
        })
        .returning();

      const hasId = !!setting?.id;
      const result: TestResult = {
        table: 'user_settings',
        success: hasId,
        hasId,
        id: setting?.id,
      };

      // 清理测试数据
      if (setting?.id) {
        await db.delete(userSettings).where(eq(userSettings.id, setting.id));
      }
      await db.delete(users).where(eq(users.id, author.id));

      return result;
    } catch (error: any) {
      return {
        table: 'user_settings',
        success: false,
        hasId: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 开始测试 UUID 自动生成功能...\n');
    console.log('等待数据库连接...');
    await waitForDatabase();
    console.log('✅ 数据库连接成功\n');

    const tests = [
      { name: 'users', fn: () => this.testUsersTable() },
      { name: 'rotes', fn: () => this.testRotesTable() },
      { name: 'attachments', fn: () => this.testAttachmentsTable() },
      { name: 'reactions', fn: () => this.testReactionsTable() },
      { name: 'user_settings', fn: () => this.testUserSettingsTable() },
    ];

    for (const test of tests) {
      console.log(`测试 ${test.name} 表...`);
      const result = await test.fn();
      this.results.push(result);

      if (result.success) {
        console.log(`  ✅ ${test.name}: ID 自动生成成功 (${result.id})`);
      } else {
        console.log(`  ❌ ${test.name}: ID 自动生成失败`);
        if (result.error) {
          console.log(`     错误: ${result.error}`);
        }
      }
      console.log('');
    }

    this.showSummary();
  }

  /**
   * 显示测试摘要
   */
  showSummary() {
    console.log('='.repeat(80));
    console.log('📊 测试结果摘要');
    console.log('='.repeat(80));

    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const total = this.results.length;

    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed} ✅`);
    console.log(`失败: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n失败的测试:');
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  ❌ ${r.table}: ${r.error || '未生成 ID'}`);
        });
    }

    console.log('\n详细结果:');
    this.results.forEach((r) => {
      const status = r.success ? '✅' : '❌';
      const idInfo = r.id ? ` (ID: ${r.id})` : '';
      console.log(`  ${status} ${r.table}${idInfo}`);
    });
  }
}

// 运行测试
if (require.main === module) {
  const tester = new UuidGenerationTester();
  tester
    .runAllTests()
    .then(() => {
      console.log('\n测试完成');
      return closeDatabase();
    })
    .catch((error) => {
      console.error('\n❌ 测试执行失败:', error);
      return closeDatabase();
    });
}

export { UuidGenerationTester };
