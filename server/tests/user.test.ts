/**
 * 用户相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class UserTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试获取用户信息
   */
  async testGetUserInfo(username: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.get(`/users/${username}`);

      TestAssertions.assertStatus(response.status, 200, 'Get User Info');
      TestAssertions.assertSuccess(response.data, 'Get User Info');

      const user = response.data.data;
      TestAssertions.assertNotNull(user, 'User should be retrieved');
      TestAssertions.assertEquals(user.username, username, 'Username should match');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get User Info',
        true,
        `User ${username} retrieved`,
        duration
      );
      return user;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get User Info',
        false,
        `Failed to get user ${username}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取当前用户个人资料
   */
  async testGetMyProfile() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/users/me/profile');

      TestAssertions.assertStatus(response.status, 200, 'Get My Profile');
      TestAssertions.assertSuccess(response.data, 'Get My Profile');

      const profile = response.data.data;
      TestAssertions.assertNotNull(profile, 'Profile should be retrieved');
      // 响应可能直接返回用户数据，也可能包装在 user 字段中
      const userData = profile.user || profile;
      TestAssertions.assertNotNull(userData, 'User data should be present');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get My Profile', true, 'Profile retrieved', duration);
      return profile;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get My Profile',
        false,
        'Failed to get profile',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试更新个人资料
   */
  async testUpdateProfile(updates: { nickname?: string; description?: string; avatar?: string }) {
    const startTime = Date.now();
    try {
      const response = await this.client.put('/users/me/profile', updates);

      TestAssertions.assertStatus(response.status, 200, 'Update Profile');
      TestAssertions.assertSuccess(response.data, 'Update Profile');

      const profile = response.data.data;
      TestAssertions.assertNotNull(profile, 'Profile should be updated');

      if (updates.nickname) {
        const userData = profile.user || profile;
        TestAssertions.assertEquals(
          userData.nickname,
          updates.nickname,
          'Nickname should be updated'
        );
      }

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Update Profile', true, 'Profile updated', duration);
      return profile;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update Profile',
        false,
        'Failed to update profile',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取用户标签
   */
  async testGetMyTags() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/users/me/tags');

      TestAssertions.assertStatus(response.status, 200, 'Get My Tags');
      TestAssertions.assertSuccess(response.data, 'Get My Tags');

      const tags = response.data.data;
      TestAssertions.assertNotNull(tags, 'Tags should be retrieved');
      TestAssertions.assertNotNull(Array.isArray(tags), 'Tags should be an array');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get My Tags',
        true,
        `Retrieved ${tags.length} tags`,
        duration
      );
      return tags;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get My Tags', false, 'Failed to get tags', duration, error);
      return null;
    }
  }

  /**
   * 测试获取用户统计信息
   */
  async testGetStatistics() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/users/me/statistics');

      TestAssertions.assertStatus(response.status, 200, 'Get Statistics');
      TestAssertions.assertSuccess(response.data, 'Get Statistics');

      const stats = response.data.data;
      TestAssertions.assertNotNull(stats, 'Statistics should be retrieved');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get Statistics', true, 'Statistics retrieved', duration);
      return stats;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Statistics',
        false,
        'Failed to get statistics',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取热力图数据
   */
  async testGetHeatMap(startDate: string, endDate: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.get(
        `/users/me/heatmap?startDate=${startDate}&endDate=${endDate}`
      );

      TestAssertions.assertStatus(response.status, 200, 'Get Heat Map');
      TestAssertions.assertSuccess(response.data, 'Get Heat Map');

      const heatMap = response.data.data;
      TestAssertions.assertNotNull(heatMap, 'Heat map data should be retrieved');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get Heat Map', true, 'Heat map data retrieved', duration);
      return heatMap;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Heat Map',
        false,
        'Failed to get heat map',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试导出数据
   */
  async testExportData() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/users/me/export');

      TestAssertions.assertStatus(response.status, 200, 'Export Data');
      // 导出接口返回的是文本，不是 JSON，所以不检查 JSON 结构
      TestAssertions.assertNotNull(response.data, 'Export data should be returned');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Export Data', true, 'Data exported successfully', duration);
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Export Data',
        false,
        'Failed to export data',
        duration,
        error
      );
      return null;
    }
  }
  /**
   * 测试导入数据
   */
  async testImportData(data: any) {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/users/me/import', data);

      TestAssertions.assertStatus(response.status, 200, 'Import Data');
      TestAssertions.assertSuccess(response.data, 'Import Data');

      const result = response.data.data;
      TestAssertions.assertNotNull(result, 'Import result should be returned');
      TestAssertions.assertEquals(result.success, true, 'Import should be successful');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Import Data',
        true,
        `Imported ${result.count} items`,
        duration
      );
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Import Data',
        false,
        'Failed to import data',
        duration,
        error
      );
      return null;
    }
  }
}
