/**
 * 数据迁移脚本：修复 null 值问题，为 Drizzle schema 约束变更做准备
 *
 * 注意：此脚本只修复数据中的 null 值，不修复表结构。
 * 如果遇到 "null value in column id violates not-null constraint" 错误，
 * 请先运行 fixAllUuidDefaults.ts 修复表结构。
 *
 * 此脚本会检查并修复以下字段的 null 值：
 * - user_sw_subscriptions.keys: 设置为 {}
 * - attachments.url: 记录错误或删除无效记录
 * - attachments.storage: 设置为默认值或删除无效记录
 * - attachments.details: 设置为 {}
 * - reactions.type: 设置为默认值或删除无效记录
 * - rotes.archived: 设置为 false
 */

import { sql } from 'drizzle-orm';
import db, { closeDatabase } from '../utils/drizzle';

interface MigrationReport {
  table: string;
  field: string;
  nullCount: number;
  fixedCount: number;
  deletedCount: number;
  errors: string[];
}

class DataMigration {
  private report: MigrationReport[] = [];

  /**
   * 记录迁移结果
   */
  private recordResult(
    table: string,
    field: string,
    nullCount: number,
    fixedCount: number,
    deletedCount: number = 0,
    errors: string[] = []
  ) {
    this.report.push({
      table,
      field,
      nullCount,
      fixedCount,
      deletedCount,
      errors,
    });
  }

  /**
   * 修复 user_sw_subscriptions.keys 字段
   */
  async fixUserSwSubscriptionsKeys() {
    try {
      // 检查 null 值数量
      const nullCountResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM user_sw_subscriptions WHERE keys IS NULL`
      );
      const nullCount = parseInt((nullCountResult[0] as { count: string })?.count || '0', 10);

      if (nullCount === 0) {
        this.recordResult('user_sw_subscriptions', 'keys', 0, 0);
        console.log('✅ user_sw_subscriptions.keys: 无 null 值');
        return;
      }

      // 修复 null 值，设置为空对象 {}
      const result = await db.execute<{ id: string }>(
        sql`UPDATE user_sw_subscriptions SET keys = '{}'::jsonb WHERE keys IS NULL RETURNING id`
      );

      const fixedCount = result.length || 0;
      this.recordResult('user_sw_subscriptions', 'keys', nullCount, fixedCount);
      console.log(`✅ user_sw_subscriptions.keys: 修复了 ${fixedCount} 条记录的 null 值`);
    } catch (error: any) {
      this.recordResult('user_sw_subscriptions', 'keys', 0, 0, 0, [error.message || String(error)]);
      console.error('❌ user_sw_subscriptions.keys 修复失败:', error);
    }
  }

  /**
   * 修复 attachments.url 字段
   */
  async fixAttachmentsUrl() {
    try {
      // 检查 null 值数量
      const nullCountResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM attachments WHERE url IS NULL`
      );
      const nullCount = parseInt((nullCountResult[0] as { count: string })?.count || '0', 10);

      if (nullCount === 0) {
        this.recordResult('attachments', 'url', 0, 0);
        console.log('✅ attachments.url: 无 null 值');
        return;
      }

      // url 是必填字段，无法设置默认值，删除无效记录
      const result = await db.execute<{ id: string }>(
        sql`DELETE FROM attachments WHERE url IS NULL RETURNING id`
      );

      const deletedCount = result.length || 0;
      this.recordResult('attachments', 'url', nullCount, 0, deletedCount);
      console.log(`⚠️  attachments.url: 删除了 ${deletedCount} 条无效记录（url 为 null）`);
    } catch (error: any) {
      this.recordResult('attachments', 'url', 0, 0, 0, [error.message || String(error)]);
      console.error('❌ attachments.url 修复失败:', error);
    }
  }

  /**
   * 修复 attachments.storage 字段
   */
  async fixAttachmentsStorage() {
    try {
      // 检查 null 值数量
      const nullCountResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM attachments WHERE storage IS NULL`
      );
      const nullCount = parseInt((nullCountResult[0] as { count: string })?.count || '0', 10);

      if (nullCount === 0) {
        this.recordResult('attachments', 'storage', 0, 0);
        console.log('✅ attachments.storage: 无 null 值');
        return;
      }

      // storage 是必填字段，尝试从 details 中推断，否则删除
      // 先尝试设置为 'local'（常见默认值）
      const updateResult = await db.execute<{ id: string }>(
        sql`UPDATE attachments SET storage = 'local' WHERE storage IS NULL RETURNING id`
      );

      const fixedCount = updateResult.length || 0;
      this.recordResult('attachments', 'storage', nullCount, fixedCount);
      console.log(
        `✅ attachments.storage: 修复了 ${fixedCount} 条记录的 null 值（设置为 'local'）`
      );
    } catch (error: any) {
      this.recordResult('attachments', 'storage', 0, 0, 0, [error.message || String(error)]);
      console.error('❌ attachments.storage 修复失败:', error);
    }
  }

  /**
   * 修复 attachments.details 字段
   */
  async fixAttachmentsDetails() {
    try {
      // 检查 null 值数量
      const nullCountResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM attachments WHERE details IS NULL`
      );
      const nullCount = parseInt((nullCountResult[0] as { count: string })?.count || '0', 10);

      if (nullCount === 0) {
        this.recordResult('attachments', 'details', 0, 0);
        console.log('✅ attachments.details: 无 null 值');
        return;
      }

      // 修复 null 值，设置为空对象 {}
      const result = await db.execute<{ id: string }>(
        sql`UPDATE attachments SET details = '{}'::jsonb WHERE details IS NULL RETURNING id`
      );

      const fixedCount = result.length || 0;
      this.recordResult('attachments', 'details', nullCount, fixedCount);
      console.log(`✅ attachments.details: 修复了 ${fixedCount} 条记录的 null 值`);
    } catch (error: any) {
      this.recordResult('attachments', 'details', 0, 0, 0, [error.message || String(error)]);
      console.error('❌ attachments.details 修复失败:', error);
    }
  }

  /**
   * 修复 reactions.type 字段
   */
  async fixReactionsType() {
    try {
      // 检查 null 值数量
      const nullCountResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM reactions WHERE type IS NULL`
      );
      const nullCount = parseInt((nullCountResult[0] as { count: string })?.count || '0', 10);

      if (nullCount === 0) {
        this.recordResult('reactions', 'type', 0, 0);
        console.log('✅ reactions.type: 无 null 值');
        return;
      }

      // type 是必填字段，无法设置默认值，删除无效记录
      const result = await db.execute<{ id: string }>(
        sql`DELETE FROM reactions WHERE type IS NULL RETURNING id`
      );

      const deletedCount = result.length || 0;
      this.recordResult('reactions', 'type', nullCount, 0, deletedCount);
      console.log(`⚠️  reactions.type: 删除了 ${deletedCount} 条无效记录（type 为 null）`);
    } catch (error: any) {
      this.recordResult('reactions', 'type', 0, 0, 0, [error.message || String(error)]);
      console.error('❌ reactions.type 修复失败:', error);
    }
  }

  /**
   * 修复 rotes.archived 字段
   */
  async fixRotesArchived() {
    try {
      // 检查 null 值数量
      const nullCountResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM rotes WHERE archived IS NULL`
      );
      const nullCount = parseInt((nullCountResult[0] as { count: string })?.count || '0', 10);

      if (nullCount === 0) {
        this.recordResult('rotes', 'archived', 0, 0);
        console.log('✅ rotes.archived: 无 null 值');
        return;
      }

      // 修复 null 值，设置为 false
      const result = await db.execute<{ id: string }>(
        sql`UPDATE rotes SET archived = false WHERE archived IS NULL RETURNING id`
      );

      const fixedCount = result.length || 0;
      this.recordResult('rotes', 'archived', nullCount, fixedCount);
      console.log(`✅ rotes.archived: 修复了 ${fixedCount} 条记录的 null 值（设置为 false）`);
    } catch (error: any) {
      this.recordResult('rotes', 'archived', 0, 0, 0, [error.message || String(error)]);
      console.error('❌ rotes.archived 修复失败:', error);
    }
  }

  /**
   * 执行所有迁移
   */
  async migrate() {
    console.log('🚀 开始数据迁移...\n');

    await this.fixUserSwSubscriptionsKeys();
    await this.fixAttachmentsUrl();
    await this.fixAttachmentsStorage();
    await this.fixAttachmentsDetails();
    await this.fixReactionsType();
    await this.fixRotesArchived();

    console.log('\n📊 迁移报告:');
    console.log('='.repeat(80));
    this.report.forEach((item) => {
      console.log(`\n表: ${item.table}.${item.field}`);
      console.log(`  发现 null 值: ${item.nullCount}`);
      console.log(`  修复数量: ${item.fixedCount}`);
      if (item.deletedCount > 0) {
        console.log(`  删除数量: ${item.deletedCount}`);
      }
      if (item.errors.length > 0) {
        console.log(`  错误: ${item.errors.join(', ')}`);
      }
    });
    console.log('\n' + '='.repeat(80));

    const totalNull = this.report.reduce((sum, item) => sum + item.nullCount, 0);
    const totalFixed = this.report.reduce((sum, item) => sum + item.fixedCount, 0);
    const totalDeleted = this.report.reduce((sum, item) => sum + item.deletedCount, 0);

    console.log(`\n总计:`);
    console.log(`  发现 null 值: ${totalNull}`);
    console.log(`  修复数量: ${totalFixed}`);
    console.log(`  删除数量: ${totalDeleted}`);

    if (totalNull === 0) {
      console.log('\n✅ 所有字段都没有 null 值，无需修复');
    } else {
      console.log(
        `\n✅ 数据迁移完成！修复了 ${totalFixed} 条记录，删除了 ${totalDeleted} 条无效记录`
      );
    }
  }
}

// 执行迁移
async function main() {
  const migration = new DataMigration();
  try {
    await migration.migrate();
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
