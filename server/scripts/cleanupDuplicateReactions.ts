/**
 * 清理重复的 reaction 数据
 *
 * 此脚本会：
 * 1. 识别所有具有相同 (userid, visitorId, roteid, type) 的重复记录
 * 2. 在每个重复组中，保留最早创建的记录（基于 createdAt）
 * 3. 删除其他重复记录
 *
 * 脚本是幂等的，可以安全地多次运行
 */

import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import db, { closeDatabase, waitForDatabase } from '../utils/drizzle';

// 获取 postgres 客户端用于原始 SQL 查询
const connectionString = process.env.POSTGRESQL_URL || '';
if (!connectionString) {
  throw new Error('POSTGRESQL_URL environment variable is not set');
}
const queryClient = postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

interface DuplicateGroup {
  userid: string | null;
  visitorId: string | null;
  roteid: string;
  type: string;
  count: number;
}

interface DuplicateRecord {
  id: string;
  userid: string | null;
  visitorId: string | null;
  roteid: string;
  type: string;
  createdAt: Date;
}

async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  console.log('🔍 正在查找重复的 reaction 数据...');

  // 使用 SQL 查询找出所有重复组
  const duplicateGroups = await queryClient<DuplicateGroup[]>`
    SELECT 
      "userid",
      "visitorId",
      "roteid",
      "type",
      COUNT(*)::int as count
    FROM reactions
    GROUP BY "userid", "visitorId", "roteid", "type"
    HAVING COUNT(*) > 1
    ORDER BY count DESC, "roteid", "type"
  `;

  return duplicateGroups || [];
}

async function getDuplicateRecords(
  userid: string | null,
  visitorId: string | null,
  roteid: string,
  type: string
): Promise<DuplicateRecord[]> {
  // 获取该组的所有记录，按创建时间排序
  // 使用 IS NOT DISTINCT FROM 正确处理 NULL 值比较（PostgreSQL 标准方法）
  const records = await queryClient<DuplicateRecord[]>`
    SELECT 
      id,
      "userid",
      "visitorId",
      "roteid",
      "type",
      "createdAt"
    FROM reactions
    WHERE 
      ("userid" IS NOT DISTINCT FROM ${userid})
      AND ("visitorId" IS NOT DISTINCT FROM ${visitorId})
      AND "roteid" = ${roteid}
      AND "type" = ${type}
    ORDER BY "createdAt" ASC
  `;

  return records || [];
}

async function cleanupDuplicates(): Promise<void> {
  try {
    console.log('🚀 开始清理重复的 reaction 数据...\n');

    // 等待数据库连接
    await waitForDatabase();

    // 查找所有重复组
    const duplicateGroups = await findDuplicateGroups();

    if (duplicateGroups.length === 0) {
      console.log('✅ 没有发现重复的 reaction 数据，数据库已经是干净的！');
      return;
    }

    console.log(
      `📊 发现 ${duplicateGroups.length} 个重复组，共 ${duplicateGroups.reduce((sum, g) => sum + Number(g.count), 0)} 条重复记录\n`
    );

    let totalDeleted = 0;
    let totalKept = 0;
    const deletedIds: string[] = [];

    // 使用事务确保原子性
    await db.transaction(async (tx) => {
      for (const group of duplicateGroups) {
        // 获取该组的所有记录
        const records = await getDuplicateRecords(
          group.userid,
          group.visitorId,
          group.roteid,
          group.type
        );

        if (records.length <= 1) {
          continue; // 如果只有一条记录，跳过
        }

        // 保留最早创建的记录（第一条）
        const keepRecord = records[0];
        const deleteRecords = records.slice(1);

        console.log(
          `  📝 处理重复组: roteid=${group.roteid}, type=${group.type}, userid=${group.userid || 'null'}, visitorId=${group.visitorId || 'null'}`
        );
        console.log(`    保留记录: id=${keepRecord.id}, createdAt=${keepRecord.createdAt}`);
        console.log(`    删除 ${deleteRecords.length} 条重复记录`);

        // 删除重复记录
        for (const record of deleteRecords) {
          await tx.execute(sql`DELETE FROM reactions WHERE id = ${record.id}`);
          deletedIds.push(record.id);
          totalDeleted++;
        }

        totalKept++;
      }
    });

    console.log('\n✅ 清理完成！');
    console.log(`📊 统计信息:`);
    console.log(`  - 处理的重复组: ${duplicateGroups.length}`);
    console.log(`  - 保留的记录: ${totalKept}`);
    console.log(`  - 删除的记录: ${totalDeleted}`);
    console.log(
      `  - 删除的记录 ID: ${deletedIds.length > 0 ? deletedIds.slice(0, 10).join(', ') + (deletedIds.length > 10 ? ` ... (共 ${deletedIds.length} 条)` : '') : '无'}`
    );

    // 验证清理结果
    const remainingDuplicates = await findDuplicateGroups();
    if (remainingDuplicates.length > 0) {
      console.warn(
        `\n⚠️  警告: 仍有 ${remainingDuplicates.length} 个重复组未清理，可能需要重新运行脚本`
      );
    } else {
      console.log('\n✅ 验证通过: 所有重复数据已清理完毕！');
    }
  } catch (error: any) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await queryClient.end();
    await closeDatabase();
  }
}

// 运行清理脚本
if (require.main === module) {
  cleanupDuplicates()
    .then(() => {
      console.log('\n🎉 脚本执行完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

export { cleanupDuplicates };
