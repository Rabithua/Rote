/**
 * 反应相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class ReactionTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;
  private createdReactions: Array<{ roteid: string; type: string }> = [];

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试添加反应
   */
  async testAddReaction(roteid: string, type: string, visitorId?: string) {
    const startTime = Date.now();
    try {
      const body: any = {
        type,
        roteid,
      };

      if (visitorId) {
        body.visitorId = visitorId;
        body.visitorInfo = { userAgent: 'test' };
      }

      const response = await this.client.post('/reactions', body);

      TestAssertions.assertStatus(response.status, 201, 'Add Reaction');
      TestAssertions.assertSuccess(response.data, 'Add Reaction');

      const reaction = response.data.data;
      TestAssertions.assertNotNull(reaction, 'Reaction should be created');
      TestAssertions.assertEquals(reaction.type, type, 'Reaction type should match');
      TestAssertions.assertEquals(reaction.roteid, roteid, 'Rote ID should match');

      this.createdReactions.push({ roteid, type });

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Add Reaction',
        true,
        `Reaction ${type} added to note ${roteid}`,
        duration,
        undefined,
        { reactionId: reaction.id }
      );

      return reaction;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      const errorDetails =
        error.response?.data?.message || error.response?.data?.error || errorMessage;
      this.resultManager.recordResult(
        'Add Reaction',
        false,
        `Failed to add reaction: ${errorDetails}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试删除反应
   */
  async testRemoveReaction(roteid: string, type: string, visitorId?: string) {
    const startTime = Date.now();
    try {
      let endpoint = `/reactions/${roteid}/${type}`;
      if (visitorId) {
        endpoint += `?visitorId=${visitorId}`;
      }

      const response = await this.client.delete(endpoint);

      TestAssertions.assertStatus(response.status, 200, 'Remove Reaction');
      TestAssertions.assertSuccess(response.data, 'Remove Reaction');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Remove Reaction',
        true,
        `Reaction ${type} removed from note ${roteid}`,
        duration
      );

      // 从记录中移除
      this.createdReactions = this.createdReactions.filter(
        (r) => !(r.roteid === roteid && r.type === type)
      );

      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Remove Reaction',
        false,
        'Failed to remove reaction',
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 清理创建的反应
   */
  async cleanup() {
    for (const reaction of this.createdReactions) {
      try {
        await this.testRemoveReaction(reaction.roteid, reaction.type);
      } catch {
        // 忽略清理错误
      }
    }
    this.createdReactions = [];
  }
}
