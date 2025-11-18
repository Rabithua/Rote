/**
 * 变更记录相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class ChangeTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试根据原始笔记ID获取变更记录
   */
  async testGetChangesByOriginId(originid: string, skip?: number, limit?: number) {
    const startTime = Date.now();
    try {
      let endpoint = `/changes/origin/${originid}`;
      const params = new URLSearchParams();
      if (skip !== undefined) params.append('skip', skip.toString());
      if (limit !== undefined) params.append('limit', limit.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const response = await this.client.get(endpoint);

      TestAssertions.assertStatus(response.status, 200, 'Get Changes By Origin ID');
      TestAssertions.assertSuccess(response.data, 'Get Changes By Origin ID');

      const changes = response.data.data;
      TestAssertions.assertNotNull(changes, 'Changes should be retrieved');
      TestAssertions.assertNotNull(Array.isArray(changes), 'Changes should be an array');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes By Origin ID',
        true,
        `Retrieved ${changes.length} changes`,
        duration,
        undefined,
        { count: changes.length }
      );
      return changes;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes By Origin ID',
        false,
        'Failed to get changes by origin ID',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试根据笔记ID获取变更记录
   */
  async testGetChangesByRoteId(roteid: string, skip?: number, limit?: number) {
    const startTime = Date.now();
    try {
      let endpoint = `/changes/rote/${roteid}`;
      const params = new URLSearchParams();
      if (skip !== undefined) params.append('skip', skip.toString());
      if (limit !== undefined) params.append('limit', limit.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const response = await this.client.get(endpoint);

      TestAssertions.assertStatus(response.status, 200, 'Get Changes By Rote ID');
      TestAssertions.assertSuccess(response.data, 'Get Changes By Rote ID');

      const changes = response.data.data;
      TestAssertions.assertNotNull(changes, 'Changes should be retrieved');
      TestAssertions.assertNotNull(Array.isArray(changes), 'Changes should be an array');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes By Rote ID',
        true,
        `Retrieved ${changes.length} changes`,
        duration,
        undefined,
        { count: changes.length }
      );
      return changes;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes By Rote ID',
        false,
        'Failed to get changes by rote ID',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试根据用户ID获取变更记录
   */
  async testGetChangesByUserId(
    skip?: number,
    limit?: number,
    action?: 'CREATE' | 'UPDATE' | 'DELETE'
  ) {
    const startTime = Date.now();
    try {
      let endpoint = '/changes/user';
      const params = new URLSearchParams();
      if (skip !== undefined) params.append('skip', skip.toString());
      if (limit !== undefined) params.append('limit', limit.toString());
      if (action) params.append('action', action);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const response = await this.client.get(endpoint);

      TestAssertions.assertStatus(response.status, 200, 'Get Changes By User ID');
      TestAssertions.assertSuccess(response.data, 'Get Changes By User ID');

      const changes = response.data.data;
      TestAssertions.assertNotNull(changes, 'Changes should be retrieved');
      TestAssertions.assertNotNull(Array.isArray(changes), 'Changes should be an array');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes By User ID',
        true,
        `Retrieved ${changes.length} changes`,
        duration,
        undefined,
        { count: changes.length }
      );
      return changes;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes By User ID',
        false,
        'Failed to get changes by user ID',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取指定时间戳之后的变更记录
   */
  async testGetChangesAfterTimestamp(
    timestamp: string | Date,
    skip?: number,
    limit?: number,
    action?: 'CREATE' | 'UPDATE' | 'DELETE'
  ) {
    const startTime = Date.now();
    try {
      let endpoint = '/changes/after';
      const params = new URLSearchParams();
      const timestampStr = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
      params.append('timestamp', timestampStr);
      if (skip !== undefined) params.append('skip', skip.toString());
      if (limit !== undefined) params.append('limit', limit.toString());
      if (action) params.append('action', action);
      endpoint += `?${params.toString()}`;

      const response = await this.client.get(endpoint);

      TestAssertions.assertStatus(response.status, 200, 'Get Changes After Timestamp');
      TestAssertions.assertSuccess(response.data, 'Get Changes After Timestamp');

      const changes = response.data.data;
      TestAssertions.assertNotNull(changes, 'Changes should be retrieved');
      TestAssertions.assertNotNull(Array.isArray(changes), 'Changes should be an array');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes After Timestamp',
        true,
        `Retrieved ${changes.length} changes`,
        duration,
        undefined,
        { count: changes.length }
      );
      return changes;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Changes After Timestamp',
        false,
        'Failed to get changes after timestamp',
        duration,
        error
      );
      return null;
    }
  }
}
