/**
 * 验证迁移结果脚本
 * 用于迁移后验证数据库结构是否正确
 */

import { sql } from 'drizzle-orm';
import db, { closeDatabase } from '../utils/drizzle';

interface VerificationResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

class MigrationVerifier {
  private results: VerificationResult[] = [];

  /**
   * 记录验证结果
   */
  private recordResult(check: string, status: 'pass' | 'fail' | 'warning', message: string) {
    this.results.push({ check, status, message });
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${check}: ${message}`);
  }

  /**
   * 验证表是否存在
   */
  async verifyTables() {
    console.log('\n📊 验证表结构...\n');

    const requiredTables = [
      'users',
      'user_settings',
      'user_open_keys',
      'user_sw_subscriptions',
      'rotes',
      'attachments',
      'reactions',
      'settings',
      'rote_changes',
    ];

    for (const table of requiredTables) {
      try {
        const result = await db.execute<{ exists: boolean }>(
          sql`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
                AND table_name = ${table}
            ) as exists;
          `
        );

        if ((result[0] as { exists: boolean })?.exists) {
          this.recordResult(`表 ${table}`, 'pass', '存在');
        } else {
          this.recordResult(`表 ${table}`, 'fail', '不存在');
        }
      } catch (error: any) {
        this.recordResult(`表 ${table}`, 'fail', `检查失败: ${error.message}`);
      }
    }
  }

  /**
   * 验证关键字段的 NOT NULL 约束
   */
  async verifyNotNullConstraints() {
    console.log('\n🔒 验证 NOT NULL 约束...\n');

    const constraints = [
      { table: 'user_sw_subscriptions', column: 'keys' },
      { table: 'attachments', column: 'url' },
      { table: 'attachments', column: 'storage' },
      { table: 'attachments', column: 'details' },
      { table: 'reactions', column: 'type' },
      { table: 'rotes', column: 'archived' },
    ];

    for (const constraint of constraints) {
      try {
        // 检查字段是否允许 null
        const nullableResult = await db.execute<{ is_nullable: string }>(
          sql`
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = ${constraint.table}
              AND column_name = ${constraint.column};
          `
        );

        const isNullable = (nullableResult[0] as { is_nullable: string })?.is_nullable === 'YES';

        // 检查是否有 null 值
        const nullCountResult = await db.execute<{ count: string }>(
          sql.raw(
            `SELECT COUNT(*)::text as count FROM ${constraint.table} WHERE ${constraint.column} IS NULL`
          )
        );
        const nullCount = parseInt((nullCountResult[0] as { count: string })?.count || '0', 10);

        if (!isNullable && nullCount === 0) {
          this.recordResult(
            `${constraint.table}.${constraint.column}`,
            'pass',
            'NOT NULL 约束已应用，无 null 值'
          );
        } else if (!isNullable && nullCount > 0) {
          this.recordResult(
            `${constraint.table}.${constraint.column}`,
            'fail',
            `NOT NULL 约束已应用，但仍有 ${nullCount} 条 null 值记录`
          );
        } else if (isNullable) {
          this.recordResult(
            `${constraint.table}.${constraint.column}`,
            'warning',
            '字段仍允许 null（可能需要添加约束）'
          );
        }
      } catch (error: any) {
        this.recordResult(
          `${constraint.table}.${constraint.column}`,
          'fail',
          `检查失败: ${error.message}`
        );
      }
    }
  }

  /**
   * 验证索引
   */
  async verifyIndexes() {
    console.log('\n📑 验证索引...\n');

    const requiredIndexes = [
      'users_email_idx',
      'users_username_idx',
      'user_settings_userid_idx',
      'user_open_keys_userid_idx',
      'user_sw_subscriptions_userid_idx',
      'user_sw_subscriptions_endpoint_idx',
      'rotes_authorid_state_idx',
      'rotes_authorid_archived_idx',
      'rotes_authorid_created_at_idx',
      'rotes_tags_idx',
      'attachments_userid_idx',
      'attachments_roteid_idx',
      'attachments_roteid_sortIndex_idx',
      'reactions_roteid_type_idx',
      'reactions_userid_idx',
      'reactions_visitorId_idx',
    ];

    for (const indexName of requiredIndexes) {
      try {
        const result = await db.execute<{ exists: boolean }>(
          sql`
            SELECT EXISTS (
              SELECT FROM pg_indexes
              WHERE schemaname = 'public'
                AND indexname = ${indexName}
            ) as exists;
          `
        );

        if ((result[0] as { exists: boolean })?.exists) {
          this.recordResult(`索引 ${indexName}`, 'pass', '存在');
        } else {
          this.recordResult(`索引 ${indexName}`, 'warning', '不存在（可能不是必需的）');
        }
      } catch (error: any) {
        this.recordResult(`索引 ${indexName}`, 'fail', `检查失败: ${error.message}`);
      }
    }
  }

  /**
   * 验证外键约束
   */
  async verifyForeignKeys() {
    console.log('\n🔗 验证外键约束...\n');

    const foreignKeys = [
      { table: 'user_settings', column: 'userid', refTable: 'users' },
      { table: 'user_open_keys', column: 'userid', refTable: 'users' },
      { table: 'user_sw_subscriptions', column: 'userid', refTable: 'users' },
      { table: 'rotes', column: 'authorid', refTable: 'users' },
      { table: 'attachments', column: 'userid', refTable: 'users' },
      { table: 'attachments', column: 'roteid', refTable: 'rotes' },
      { table: 'reactions', column: 'roteid', refTable: 'rotes' },
      { table: 'reactions', column: 'userid', refTable: 'users' },
      { table: 'rote_changes', column: 'roteid', refTable: 'rotes' },
    ];

    for (const fk of foreignKeys) {
      try {
        const result = await db.execute<{ count: string }>(
          sql`
            SELECT COUNT(*) as count
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = ${fk.table}
              AND kcu.column_name = ${fk.column};
          `
        );

        const count = parseInt((result[0] as { count: string })?.count || '0', 10);
        if (count > 0) {
          this.recordResult(`${fk.table}.${fk.column} -> ${fk.refTable}`, 'pass', '外键约束存在');
        } else {
          this.recordResult(
            `${fk.table}.${fk.column} -> ${fk.refTable}`,
            'warning',
            '外键约束不存在（可能不是必需的）'
          );
        }
      } catch (error: any) {
        this.recordResult(
          `${fk.table}.${fk.column} -> ${fk.refTable}`,
          'fail',
          `检查失败: ${error.message}`
        );
      }
    }
  }

  /**
   * 验证数据完整性
   */
  async verifyDataIntegrity() {
    console.log('\n🔍 验证数据完整性...\n');

    // 检查孤立记录
    try {
      const orphanedAttachments = await db.execute<{ count: string }>(
        sql`
          SELECT COUNT(*) as count
          FROM attachments a
          WHERE a.roteid IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM rotes r WHERE r.id = a.roteid
            );
        `
      );

      const count = parseInt((orphanedAttachments[0] as { count: string })?.count || '0', 10);
      if (count === 0) {
        this.recordResult('附件数据完整性', 'pass', '无孤立附件记录');
      } else {
        this.recordResult(
          '附件数据完整性',
          'warning',
          `发现 ${count} 条孤立附件记录（可能正常，如果 roteid 允许为 null）`
        );
      }
    } catch (error: any) {
      this.recordResult('附件数据完整性', 'fail', `检查失败: ${error.message}`);
    }
  }

  /**
   * 运行所有验证
   */
  async runAllVerifications() {
    console.log('🔍 开始验证迁移结果...\n');
    console.log('='.repeat(80));

    await this.verifyTables();
    await this.verifyNotNullConstraints();
    await this.verifyIndexes();
    await this.verifyForeignKeys();
    await this.verifyDataIntegrity();

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 验证摘要:');

    const passed = this.results.filter((r) => r.status === 'pass').length;
    const failed = this.results.filter((r) => r.status === 'fail').length;
    const warnings = this.results.filter((r) => r.status === 'warning').length;

    console.log(`✅ 通过: ${passed}`);
    console.log(`⚠️  警告: ${warnings}`);
    console.log(`❌ 失败: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ 迁移验证失败，请检查上述问题！');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️  迁移验证完成，但有警告，请检查上述项目。');
    } else {
      console.log('\n✅ 迁移验证全部通过！');
    }
  }
}

// 执行验证
async function main() {
  const verifier = new MigrationVerifier();
  try {
    await verifier.runAllVerifications();
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
