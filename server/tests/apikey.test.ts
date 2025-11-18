/**
 * API Key 相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class ApiKeyTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;
  private createdApiKeyIds: string[] = [];

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试生成 API Key
   */
  async testGenerateApiKey() {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/api-keys');

      TestAssertions.assertStatus(response.status, 201, 'Generate API Key');
      TestAssertions.assertSuccess(response.data, 'Generate API Key');

      const apiKey = response.data.data;
      TestAssertions.assertNotNull(apiKey, 'API Key should be generated');
      // API Key 可能是数组或单个对象
      const keyData = Array.isArray(apiKey) ? apiKey[0] : apiKey;
      TestAssertions.assertNotNull(keyData, 'API Key data should be present');
      TestAssertions.assertNotNull(keyData.id, 'API Key should have an ID');
      TestAssertions.assertNotNull(keyData.key, 'API Key should have a key value');

      this.createdApiKeyIds.push(keyData.id);

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Generate API Key',
        true,
        `API Key generated with ID: ${keyData.id}`,
        duration,
        undefined,
        { apiKeyId: keyData.id }
      );

      return keyData;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      const errorDetails =
        error.response?.data?.message || error.response?.data?.error || errorMessage;
      this.resultManager.recordResult(
        'Generate API Key',
        false,
        `Failed to generate API Key: ${errorDetails}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取所有 API Keys
   */
  async testGetApiKeys() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/api-keys');

      TestAssertions.assertStatus(response.status, 200, 'Get API Keys');
      TestAssertions.assertSuccess(response.data, 'Get API Keys');

      const apiKeys = response.data.data;
      TestAssertions.assertNotNull(apiKeys, 'API Keys should be retrieved');
      // API Keys 可能是数组，也可能是单个对象
      const keysArray = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
      TestAssertions.assertNotNull(Array.isArray(keysArray), 'API Keys should be an array');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get API Keys',
        true,
        `Retrieved ${keysArray.length} API Keys`,
        duration,
        undefined,
        { count: keysArray.length }
      );
      return keysArray;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get API Keys',
        false,
        'Failed to get API Keys',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试更新 API Key
   */
  async testUpdateApiKey(apiKeyId: string, updates: { name?: string; permissions?: string[] }) {
    const startTime = Date.now();
    try {
      const response = await this.client.put(`/api-keys/${apiKeyId}`, updates);

      TestAssertions.assertStatus(response.status, 200, 'Update API Key');
      TestAssertions.assertSuccess(response.data, 'Update API Key');

      const apiKey = response.data.data;
      TestAssertions.assertNotNull(apiKey, 'API Key should be updated');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update API Key',
        true,
        `API Key ${apiKeyId} updated`,
        duration
      );
      return apiKey;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update API Key',
        false,
        `Failed to update API Key ${apiKeyId}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试删除 API Key
   */
  async testDeleteApiKey(apiKeyId: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.delete(`/api-keys/${apiKeyId}`);

      TestAssertions.assertStatus(response.status, 200, 'Delete API Key');
      TestAssertions.assertSuccess(response.data, 'Delete API Key');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete API Key',
        true,
        `API Key ${apiKeyId} deleted`,
        duration
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete API Key',
        false,
        `Failed to delete API Key ${apiKeyId}`,
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 清理创建的测试 API Keys
   */
  async cleanup() {
    for (const apiKeyId of this.createdApiKeyIds) {
      try {
        await this.testDeleteApiKey(apiKeyId);
      } catch {
        // 忽略清理错误
      }
    }
    this.createdApiKeyIds = [];
  }

  /**
   * 获取创建的 API Key ID 列表
   */
  getCreatedApiKeyIds(): string[] {
    return [...this.createdApiKeyIds];
  }
}
