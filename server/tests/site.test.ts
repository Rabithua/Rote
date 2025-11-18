/**
 * 站点相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class SiteTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试获取站点地图数据
   */
  async testGetSitemap() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/site/sitemap');

      TestAssertions.assertStatus(response.status, 200, 'Get Sitemap');
      TestAssertions.assertSuccess(response.data, 'Get Sitemap');

      const sitemap = response.data.data;
      TestAssertions.assertNotNull(sitemap, 'Sitemap data should be retrieved');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get Sitemap', true, 'Sitemap data retrieved', duration);
      return sitemap;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Sitemap',
        false,
        'Failed to get sitemap',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取站点状态
   */
  async testGetSiteStatus() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/site/status');

      TestAssertions.assertStatus(response.status, 200, 'Get Site Status');
      TestAssertions.assertSuccess(response.data, 'Get Site Status');

      const status = response.data.data;
      TestAssertions.assertNotNull(status, 'Site status should be retrieved');
      TestAssertions.assertNotNull(status.isInitialized, 'isInitialized should be present');
      TestAssertions.assertNotNull(status.databaseConnected, 'databaseConnected should be present');
      TestAssertions.assertNotNull(status.site, 'Site info should be present');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get Site Status', true, 'Site status retrieved', duration);
      return status;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Site Status',
        false,
        'Failed to get site status',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取配置状态
   */
  async testGetConfigStatus() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/site/config-status');

      TestAssertions.assertStatus(response.status, 200, 'Get Config Status');
      TestAssertions.assertSuccess(response.data, 'Get Config Status');

      const configStatus = response.data.data;
      TestAssertions.assertNotNull(configStatus, 'Config status should be retrieved');
      TestAssertions.assertNotNull(
        typeof configStatus.isInitialized === 'boolean',
        'isInitialized should be boolean'
      );

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Config Status',
        true,
        'Config status retrieved',
        duration
      );
      return configStatus;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Config Status',
        false,
        'Failed to get config status',
        duration,
        error
      );
      return null;
    }
  }
}
