/**
 * 订阅相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class SubscriptionTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;
  private createdSubscriptionIds: string[] = [];

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试添加订阅
   */
  async testAddSubscription(subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }) {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/subscriptions', subscription);

      TestAssertions.assertStatus(response.status, [200, 201], 'Add Subscription');
      TestAssertions.assertSuccess(response.data, 'Add Subscription');

      const result = response.data.data;
      TestAssertions.assertNotNull(result, 'Subscription should be created or retrieved');
      TestAssertions.assertNotNull(result.id, 'Subscription should have an ID');

      if (response.status === 201) {
        this.createdSubscriptionIds.push(result.id);
      }

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Add Subscription',
        true,
        `Subscription ${response.status === 201 ? 'created' : 'retrieved'} with ID: ${result.id}`,
        duration,
        undefined,
        { subscriptionId: result.id }
      );

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      const errorDetails =
        error.response?.data?.message || error.response?.data?.error || errorMessage;
      this.resultManager.recordResult(
        'Add Subscription',
        false,
        `Failed to add subscription: ${errorDetails}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取用户订阅
   */
  async testGetSubscriptions() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/subscriptions');

      TestAssertions.assertStatus(response.status, 200, 'Get Subscriptions');
      TestAssertions.assertSuccess(response.data, 'Get Subscriptions');

      const subscriptions = response.data.data;
      TestAssertions.assertNotNull(subscriptions, 'Subscriptions should be retrieved');
      TestAssertions.assertNotNull(
        Array.isArray(subscriptions),
        'Subscriptions should be an array'
      );

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Subscriptions',
        true,
        `Retrieved ${subscriptions.length} subscriptions`,
        duration,
        undefined,
        { count: subscriptions.length }
      );
      return subscriptions;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Subscriptions',
        false,
        'Failed to get subscriptions',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试更新订阅
   */
  async testUpdateSubscription(subscriptionId: string, updateData: { status?: string }) {
    const startTime = Date.now();
    try {
      const response = await this.client.put(`/subscriptions/${subscriptionId}`, updateData);

      TestAssertions.assertStatus(response.status, 200, 'Update Subscription');
      TestAssertions.assertSuccess(response.data, 'Update Subscription');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update Subscription',
        true,
        `Subscription ${subscriptionId} updated`,
        duration
      );
      return response.data.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update Subscription',
        false,
        `Failed to update subscription ${subscriptionId}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试删除订阅
   */
  async testDeleteSubscription(subscriptionId: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.delete(`/subscriptions/${subscriptionId}`);

      TestAssertions.assertStatus(response.status, 200, 'Delete Subscription');
      TestAssertions.assertSuccess(response.data, 'Delete Subscription');

      // 从记录中移除
      this.createdSubscriptionIds = this.createdSubscriptionIds.filter(
        (id) => id !== subscriptionId
      );

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete Subscription',
        true,
        `Subscription ${subscriptionId} deleted`,
        duration
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete Subscription',
        false,
        `Failed to delete subscription ${subscriptionId}`,
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 清理创建的订阅
   */
  async cleanup() {
    for (const subscriptionId of this.createdSubscriptionIds) {
      try {
        await this.testDeleteSubscription(subscriptionId);
      } catch {
        // 忽略清理错误
      }
    }
    this.createdSubscriptionIds = [];
  }

  /**
   * 获取创建的订阅 ID 列表
   */
  getCreatedSubscriptionIds(): string[] {
    return [...this.createdSubscriptionIds];
  }
}
