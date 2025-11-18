/**
 * Update attachments with compressUrl
 */

import { eq } from 'drizzle-orm';
import { attachments } from '../drizzle/schema';
import db, { closeDatabase } from '../utils/drizzle';

async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

function generateCompressUrl(originalUrl: string): string {
  const parsedUrl = new URL(originalUrl);
  const pathParts = parsedUrl.pathname.split('/');

  const compressedIndex = pathParts.indexOf('uploads');
  if (compressedIndex !== -1) {
    pathParts[compressedIndex] = 'compressed';
  }

  const filename = pathParts[pathParts.length - 1];
  const nameWithoutExt = filename.split('.').slice(0, -1).join('.');
  pathParts[pathParts.length - 1] = `${nameWithoutExt}.webp`;

  parsedUrl.pathname = pathParts.join('/');
  return parsedUrl.toString();
}

async function updateAttachments() {
  try {
    console.log('🚀 开始更新附件 compressUrl...\n');

    const allAttachments = await db
      .select({
        id: attachments.id,
        url: attachments.url,
        compressUrl: attachments.compressUrl,
      })
      .from(attachments);

    const totalAttachments = allAttachments.length;
    let processedAttachments = 0;
    let skippedAttachments = 0;
    let updatedAttachments = 0;
    let errorCount = 0;

    console.log(`📊 找到 ${totalAttachments} 个附件需要处理\n`);

    for (const attachment of allAttachments) {
      if (!attachment.url) {
        console.log(`⚠️  跳过没有 URL 的附件: ${attachment.id}`);
        skippedAttachments++;
        processedAttachments++;
        continue;
      }

      if (attachment.compressUrl) {
        // 静默跳过已有 compressUrl 的附件
        processedAttachments++;
        continue;
      }

      try {
        const compressUrl = generateCompressUrl(attachment.url);

        if (await isUrlAccessible(compressUrl)) {
          await db
            .update(attachments)
            .set({ compressUrl })
            .where(eq(attachments.id, attachment.id));
          updatedAttachments++;
          if (updatedAttachments % 10 === 0) {
            console.log(`✅ 已更新 ${updatedAttachments} 个附件...`);
          }
        } else {
          skippedAttachments++;
        }
      } catch (error) {
        errorCount++;
        console.error(
          `❌ 处理附件 ${attachment.id} 时出错:`,
          error instanceof Error ? error.message : String(error)
        );
        skippedAttachments++;
      }

      processedAttachments++;

      // 每处理 100 个附件显示一次进度
      if (processedAttachments % 100 === 0) {
        const progress = ((processedAttachments / totalAttachments) * 100).toFixed(1);
        console.log(`📈 进度: ${processedAttachments}/${totalAttachments} (${progress}%)`);
      }
    }

    const coverageRate =
      totalAttachments > 0
        ? ((processedAttachments - skippedAttachments) / totalAttachments) * 100
        : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 处理完成统计:');
    console.log(`  总附件数: ${totalAttachments}`);
    console.log(`  已处理: ${processedAttachments}`);
    console.log(`  已更新: ${updatedAttachments}`);
    console.log(`  已跳过: ${skippedAttachments}`);
    console.log(`  错误数: ${errorCount}`);
    console.log(`  CompressUrl 覆盖率: ${coverageRate.toFixed(2)}%`);
    console.log('='.repeat(80));

    if (errorCount > 0) {
      console.log(`\n⚠️  处理过程中遇到 ${errorCount} 个错误，请检查上述错误信息`);
    } else {
      console.log('\n✅ 所有附件处理完成！');
    }
  } catch (error) {
    console.error('❌ 更新附件时发生严重错误:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

updateAttachments();
