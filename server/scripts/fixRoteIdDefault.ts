/**
 * 修复 rotes 表 id 字段的默认值
 * 用于从 Prisma 迁移到 Drizzle 后的数据库结构修复
 */

import { sql } from 'drizzle-orm';
import db, { closeDatabase } from '../utils/drizzle';

async function fixRoteIdDefault() {
  try {
    console.log('🔍 检查 rotes 表 id 字段的默认值...\n');

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
      WHERE table_name = 'rotes' AND column_name = 'id';
    `);

    console.log('当前 id 字段信息:');
    console.log('Result length:', result.length);

    if (result.length === 0) {
      console.log('\n❌ 未找到 rotes.id 字段，请检查表是否存在');
      return;
    }

    const columnInfo = result[0];
    console.log('Column info:', JSON.stringify(columnInfo, null, 2));
    const currentDefault = columnInfo?.column_default;

    if (currentDefault && currentDefault.includes('gen_random_uuid')) {
      console.log('\n✅ rotes.id 字段已经有正确的默认值 gen_random_uuid()');
      console.log('   无需修复。');
      return;
    }

    console.log('\n⚠️  检测到 rotes.id 字段缺少 gen_random_uuid() 默认值');
    console.log('   当前默认值:', currentDefault || 'NULL');
    console.log('\n🔧 开始修复...\n');

    // 确保 pgcrypto 扩展已启用
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    console.log('✅ 已确保 pgcrypto 扩展启用');

    // 修改 id 字段，添加默认值
    await db.execute(sql`
      ALTER TABLE rotes 
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
    `);
    console.log('✅ 已为 rotes.id 字段添加 gen_random_uuid() 默认值');

    // 验证修复结果
    const verifyResult = await db.execute<{
      column_name: string;
      column_default: string | null;
      is_nullable: string;
    }>(sql`
      SELECT 
        column_name,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'rotes' AND column_name = 'id';
    `);

    const verifyInfo = verifyResult[0];
    console.log('\n📊 修复后的 id 字段信息:');
    console.log(JSON.stringify(verifyInfo, null, 2));

    if (verifyInfo?.column_default && verifyInfo.column_default.includes('gen_random_uuid')) {
      console.log('\n✅ 修复成功！rotes.id 字段现在有正确的默认值。');
    } else {
      console.log('\n❌ 修复失败，请手动检查数据库。');
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
fixRoteIdDefault()
  .then(() => {
    console.log('\n✨ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 脚本执行失败:', error);
    process.exit(1);
  });
