/**
 * 修复所有表的 UUID id 字段默认值
 * 用于从 Prisma 迁移到 Drizzle 后的数据库结构修复
 */

import { sql } from 'drizzle-orm';
import db, { closeDatabase } from '../utils/drizzle';

// 所有需要修复 UUID 默认值的表
const TABLES_WITH_UUID_ID = [
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

interface FixResult {
  table: string;
  hadDefault: boolean;
  fixed: boolean;
  error?: string;
}

async function fixAllUuidDefaults() {
  const results: FixResult[] = [];

  try {
    console.log('🔍 检查所有表的 UUID id 字段默认值...\n');

    // 确保 pgcrypto 扩展已启用
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    console.log('✅ 已确保 pgcrypto 扩展启用\n');

    for (const table of TABLES_WITH_UUID_ID) {
      try {
        // 检查当前 id 字段的默认值
        const result = await db.execute<{
          column_name: string;
          column_default: string | null;
          is_nullable: string;
          data_type: string;
        }>(sql`
          SELECT 
            column_name,
            column_default,
            is_nullable,
            data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${table}
            AND column_name = 'id';
        `);

        if (result.length === 0) {
          console.log(`⚠️  表 ${table} 不存在或没有 id 字段，跳过`);
          results.push({ table, hadDefault: false, fixed: false, error: '表不存在' });
          continue;
        }

        const columnInfo = result[0];
        const currentDefault = columnInfo?.column_default;
        const hasDefault = currentDefault && currentDefault.includes('gen_random_uuid');

        if (hasDefault) {
          console.log(`✅ ${table}.id: 已有正确的默认值`);
          results.push({ table, hadDefault: true, fixed: false });
          continue;
        }

        console.log(`⚠️  ${table}.id: 缺少 gen_random_uuid() 默认值`);
        console.log(`   当前默认值: ${currentDefault || 'NULL'}`);

        // 修复：添加默认值
        await db.execute(sql`
          ALTER TABLE ${sql.identifier(table)} 
          ALTER COLUMN id SET DEFAULT gen_random_uuid();
        `);

        // 验证修复结果
        const verifyResult = await db.execute<{
          column_default: string | null;
        }>(sql`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${table}
            AND column_name = 'id';
        `);

        const verifyInfo = verifyResult[0];
        if (verifyInfo?.column_default && verifyInfo.column_default.includes('gen_random_uuid')) {
          console.log(`✅ ${table}.id: 修复成功\n`);
          results.push({ table, hadDefault: false, fixed: true });
        } else {
          console.log(`❌ ${table}.id: 修复失败\n`);
          results.push({ table, hadDefault: false, fixed: false, error: '修复后验证失败' });
        }
      } catch (error: any) {
        console.error(`❌ ${table}.id: 修复过程中出错:`, error.message);
        results.push({ table, hadDefault: false, fixed: false, error: error.message });
      }
    }

    // 打印总结报告
    console.log('\n' + '='.repeat(80));
    console.log('📊 修复报告:');
    console.log('='.repeat(80));

    const needFix = results.filter((r) => !r.hadDefault);
    const fixed = results.filter((r) => r.fixed);
    const failed = results.filter((r) => !r.hadDefault && !r.fixed);

    console.log(`\n总计: ${results.length} 个表`);
    console.log(`  已有默认值: ${results.length - needFix.length} 个`);
    console.log(`  需要修复: ${needFix.length} 个`);
    console.log(`  修复成功: ${fixed.length} 个`);
    console.log(`  修复失败: ${failed.length} 个`);

    if (failed.length > 0) {
      console.log('\n❌ 修复失败的表:');
      failed.forEach((r) => {
        console.log(`  - ${r.table}: ${r.error || '未知错误'}`);
      });
    }

    if (fixed.length > 0) {
      console.log('\n✅ 修复成功的表:');
      fixed.forEach((r) => {
        console.log(`  - ${r.table}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    if (failed.length === 0 && needFix.length === fixed.length) {
      console.log('\n✨ 所有表的 UUID id 字段默认值已修复完成！');
    } else if (failed.length > 0) {
      console.log('\n⚠️  部分表修复失败，请检查错误信息');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ 修复过程中出现错误:');
    console.error('错误信息:', error.message);
    console.error('错误详情:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// 运行修复
fixAllUuidDefaults()
  .then(() => {
    console.log('\n✨ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 脚本执行失败:', error);
    process.exit(1);
  });
