/**
 * 检查数据库当前状态脚本
 * 用于迁移前了解数据库结构
 */

import { sql } from 'drizzle-orm';
import db, { closeDatabase } from '../utils/drizzle';

interface TableInfo extends Record<string, unknown> {
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: string;
  columnDefault: string | null;
}

interface IndexInfo extends Record<string, unknown> {
  indexName: string;
  tableName: string;
  indexDefinition: string;
}

interface ConstraintInfo extends Record<string, unknown> {
  constraintName: string;
  tableName: string;
  constraintType: string;
  constraintDefinition: string;
}

class DatabaseStateChecker {
  /**
   * 检查表结构
   */
  async checkTableStructure() {
    console.log('\n📊 检查表结构...\n');

    try {
      const tables = [
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

      for (const table of tables) {
        const result = await db.execute<TableInfo>(
          sql`
            SELECT 
              table_name as "tableName",
              column_name as "columnName",
              data_type as "dataType",
              is_nullable as "isNullable",
              column_default as "columnDefault"
            FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = ${table}
            ORDER BY ordinal_position;
          `
        );

        if (result.length > 0) {
          console.log(`\n表: ${table}`);
          console.log('─'.repeat(80));
          result.forEach((col: TableInfo) => {
            console.log(
              `  ${col.columnName.padEnd(20)} ${col.dataType.padEnd(20)} ${col.isNullable === 'YES' ? 'NULL' : 'NOT NULL'.padEnd(8)} ${col.columnDefault || ''}`
            );
          });
        } else {
          console.log(`\n⚠️  表 ${table} 不存在`);
        }
      }
    } catch (error: any) {
      console.error('❌ 检查表结构失败:', error.message);
    }
  }

  /**
   * 检查索引
   */
  async checkIndexes() {
    console.log('\n\n📑 检查索引...\n');

    try {
      const result = await db.execute<IndexInfo>(
        sql`
          SELECT 
            indexname as "indexName",
            tablename as "tableName",
            indexdef as "indexDefinition"
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename IN (
              'users', 'user_settings', 'user_open_keys', 'user_sw_subscriptions',
              'rotes', 'attachments', 'reactions', 'settings', 'rote_changes'
            )
          ORDER BY tablename, indexname;
        `
      );

      if (result.length > 0) {
        result.forEach((idx: IndexInfo) => {
          console.log(`${idx.tableName}.${idx.indexName}`);
          console.log(`  ${idx.indexDefinition}`);
        });
      } else {
        console.log('⚠️  未找到索引');
      }
    } catch (error: any) {
      console.error('❌ 检查索引失败:', error.message);
    }
  }

  /**
   * 检查约束
   */
  async checkConstraints() {
    console.log('\n\n🔒 检查约束...\n');

    try {
      const result = await db.execute<ConstraintInfo>(
        sql`
          SELECT
            conname as "constraintName",
            conrelid::regclass::text as "tableName",
            contype as "constraintType",
            pg_get_constraintdef(oid) as "constraintDefinition"
          FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
            AND conrelid::regclass::text IN (
              'users', 'user_settings', 'user_open_keys', 'user_sw_subscriptions',
              'rotes', 'attachments', 'reactions', 'settings', 'rote_changes'
            )
          ORDER BY conrelid::regclass::text, conname;
        `
      );

      if (result.length > 0) {
        result.forEach((constraint: ConstraintInfo) => {
          const typeMap: Record<string, string> = {
            p: 'PRIMARY KEY',
            f: 'FOREIGN KEY',
            u: 'UNIQUE',
            c: 'CHECK',
          };
          const type = typeMap[constraint.constraintType] || constraint.constraintType;
          console.log(`${constraint.tableName}.${constraint.constraintName} (${type})`);
          console.log(`  ${constraint.constraintDefinition}`);
        });
      } else {
        console.log('⚠️  未找到约束');
      }
    } catch (error: any) {
      console.error('❌ 检查约束失败:', error.message);
    }
  }

  /**
   * 检查关键字段的 null 值
   */
  async checkNullValues() {
    console.log('\n\n🔍 检查关键字段的 null 值...\n');

    const checks = [
      {
        table: 'user_sw_subscriptions',
        column: 'keys',
        description: 'user_sw_subscriptions.keys',
      },
      {
        table: 'attachments',
        column: 'url',
        description: 'attachments.url',
      },
      {
        table: 'attachments',
        column: 'storage',
        description: 'attachments.storage',
      },
      {
        table: 'attachments',
        column: 'details',
        description: 'attachments.details',
      },
      {
        table: 'reactions',
        column: 'type',
        description: 'reactions.type',
      },
      {
        table: 'rotes',
        column: 'archived',
        description: 'rotes.archived',
      },
    ];

    for (const check of checks) {
      try {
        const result = await db.execute<{ count: string }>(
          sql.raw(
            `SELECT COUNT(*)::text as count FROM ${check.table} WHERE ${check.column} IS NULL`
          )
        );

        const nullCount = parseInt((result[0] as { count: string })?.count || '0', 10);
        if (nullCount > 0) {
          console.log(`⚠️  ${check.description}: ${nullCount} 条 null 值记录`);
        } else {
          console.log(`✅ ${check.description}: 无 null 值`);
        }
      } catch (error: any) {
        // 表或字段可能不存在
        console.log(`⚠️  ${check.description}: 无法检查 (${error.message})`);
      }
    }
  }

  /**
   * 检查数据统计
   */
  async checkDataStatistics() {
    console.log('\n\n📈 数据统计...\n');

    const tables = [
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

    for (const table of tables) {
      try {
        const result = await db.execute<{ count: string }>(
          sql.raw(`SELECT COUNT(*)::text as count FROM ${table}`)
        );
        const count = (result[0] as { count: string })?.count || '0';
        console.log(`${table.padEnd(25)} ${count.padStart(10)} 条记录`);
      } catch (_error: any) {
        console.log(`${table.padEnd(25)} ⚠️  表不存在或无法访问`);
      }
    }
  }

  /**
   * 检查迁移历史
   */
  async checkMigrationHistory() {
    console.log('\n\n📜 检查迁移历史...\n');

    try {
      // 检查 Drizzle 迁移表
      const drizzleResult = await db.execute<{ hash: string; created_at: Date }>(
        sql`
          SELECT hash, created_at 
          FROM drizzle.__drizzle_migrations 
          ORDER BY created_at DESC 
          LIMIT 10;
        `
      );

      if (drizzleResult.length > 0) {
        console.log('Drizzle 迁移历史:');
        drizzleResult.forEach((migration: { hash: string; created_at: Date }) => {
          console.log(`  ${migration.hash} - ${migration.created_at}`);
        });
      } else {
        console.log('⚠️  未找到 Drizzle 迁移历史');
      }
    } catch (_error: any) {
      console.log('⚠️  Drizzle 迁移表不存在（可能是 Prisma 数据库）');
    }

    try {
      // 检查 Prisma 迁移表
      const prismaResult = await db.execute<{ migration_name: string; finished_at: Date }>(
        sql`
          SELECT migration_name, finished_at 
          FROM _prisma_migrations 
          ORDER BY finished_at DESC 
          LIMIT 10;
        `
      );

      if (prismaResult.length > 0) {
        console.log('\nPrisma 迁移历史:');
        prismaResult.forEach((migration: { migration_name: string; finished_at: Date }) => {
          console.log(`  ${migration.migration_name} - ${migration.finished_at}`);
        });
      }
    } catch (_error: any) {
      // Prisma 迁移表可能不存在
    }
  }

  /**
   * 运行所有检查
   */
  async runAllChecks() {
    console.log('🔍 开始检查数据库状态...\n');
    console.log('='.repeat(80));

    await this.checkDataStatistics();
    await this.checkNullValues();
    await this.checkTableStructure();
    await this.checkIndexes();
    await this.checkConstraints();
    await this.checkMigrationHistory();

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ 数据库状态检查完成！');
  }
}

// 执行检查
async function main() {
  const checker = new DatabaseStateChecker();
  try {
    await checker.runAllChecks();
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
