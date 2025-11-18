/**
 * 附件相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import type { TestClient } from './utils/testClient';
import type { TestResultManager } from './utils/testResult';

export class AttachmentTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;
  private createdAttachmentIds: string[] = [];

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试预签名上传
   */
  async testPresignUpload(files: Array<{ filename?: string; contentType: string; size: number }>) {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/attachments/presign', { files });

      TestAssertions.assertStatus(response.status, 200, 'Presign Upload');
      TestAssertions.assertSuccess(response.data, 'Presign Upload');

      const presignData = response.data.data;
      TestAssertions.assertNotNull(presignData, 'Presign data should be returned');
      // 响应可能是 items 或 files 字段
      const items = presignData.items || presignData.files;
      TestAssertions.assertNotNull(items, 'Files/items should be present');
      TestAssertions.assertArrayLength(items, files.length, 'Presign files count should match');

      // 记录附件 ID（从 presign 响应中获取）
      items.forEach((item: any) => {
        if (item.attachmentId || item.uuid) {
          this.createdAttachmentIds.push(item.attachmentId || item.uuid);
        }
      });

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Presign Upload',
        true,
        `Presigned ${files.length} file(s)`,
        duration,
        undefined,
        { fileCount: files.length }
      );

      return presignData;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Presign Upload',
        false,
        'Failed to presign upload',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试完成上传
   */
  async testFinalizeUpload(attachmentIds: string[]) {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/attachments/finalize', { attachmentIds });

      TestAssertions.assertStatus(response.status, 200, 'Finalize Upload');
      TestAssertions.assertSuccess(response.data, 'Finalize Upload');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Finalize Upload',
        true,
        `Finalized ${attachmentIds.length} attachment(s)`,
        duration
      );
      return response.data.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Finalize Upload',
        false,
        'Failed to finalize upload',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试删除单个附件
   */
  async testDeleteAttachment(attachmentId: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.delete(`/attachments/${attachmentId}`);

      TestAssertions.assertStatus(response.status, 200, 'Delete Attachment');
      TestAssertions.assertSuccess(response.data, 'Delete Attachment');

      // 从记录中移除
      this.createdAttachmentIds = this.createdAttachmentIds.filter((id) => id !== attachmentId);

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete Attachment',
        true,
        `Attachment ${attachmentId} deleted`,
        duration
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete Attachment',
        false,
        `Failed to delete attachment ${attachmentId}`,
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 测试批量删除附件
   */
  async testDeleteAttachments(attachmentIds: string[]) {
    const startTime = Date.now();
    try {
      const response = await this.client.delete('/attachments/', { ids: attachmentIds });

      TestAssertions.assertStatus(response.status, 200, 'Delete Attachments');
      TestAssertions.assertSuccess(response.data, 'Delete Attachments');

      // 从记录中移除
      this.createdAttachmentIds = this.createdAttachmentIds.filter(
        (id) => !attachmentIds.includes(id)
      );

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete Attachments',
        true,
        `Deleted ${attachmentIds.length} attachment(s)`,
        duration
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete Attachments',
        false,
        'Failed to delete attachments',
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 测试更新附件排序
   */
  async testUpdateAttachmentSort(roteId: string, attachmentIds: string[]) {
    const startTime = Date.now();
    try {
      const response = await this.client.put('/attachments/sort', {
        roteId,
        attachmentIds,
      });

      TestAssertions.assertStatus(response.status, 200, 'Update Attachment Sort');
      TestAssertions.assertSuccess(response.data, 'Update Attachment Sort');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update Attachment Sort',
        true,
        `Updated sort order for ${attachmentIds.length} attachment(s)`,
        duration
      );
      return response.data.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update Attachment Sort',
        false,
        'Failed to update attachment sort',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 清理创建的附件
   */
  async cleanup() {
    for (const attachmentId of this.createdAttachmentIds) {
      try {
        await this.testDeleteAttachment(attachmentId);
      } catch {
        // 忽略清理错误
      }
    }
    this.createdAttachmentIds = [];
  }

  /**
   * 获取创建的附件 ID 列表
   */
  getCreatedAttachmentIds(): string[] {
    return [...this.createdAttachmentIds];
  }
}
