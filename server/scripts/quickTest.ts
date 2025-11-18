/**
 * 快速初始化测试脚本
 * 用于快速验证系统初始化流程
 */

import { eq, or } from 'drizzle-orm';
import { settings, users } from '../drizzle/schema';
import db, { closeDatabase } from '../utils/drizzle';
import testConfig from './testConfig.json';

const BASE_URL = process.env.TEST_BASE_URL || testConfig.testSettings.baseUrl;
const API_BASE = `${BASE_URL}${testConfig.testSettings.apiBase}/api`;

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
  error?: any;
  data?: any;
}

class QuickTester {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 记录测试结果
   */
  private recordResult(
    name: string,
    success: boolean,
    message: string,
    duration: number,
    error?: any,
    data?: any
  ) {
    this.results.push({ name, success, message, duration, error, data });
    const status = success ? '✅' : '❌';
    const durationStr = `${duration}ms`;
    console.log(`${status} ${name} (${durationStr}): ${message}`);
    if (error) {
      console.log(`   Error: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * 断言函数
   */
  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * 断言状态码
   */
  private assertStatus(status: number, expected: number | number[], context: string): void {
    const expectedArray = Array.isArray(expected) ? expected : [expected];
    if (!expectedArray.includes(status)) {
      throw new Error(`Expected status ${expectedArray.join(' or ')}, got ${status} in ${context}`);
    }
  }

  /**
   * 断言响应数据结构
   */
  private assertResponse(data: any, context: string): void {
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid response data in ${context}: expected object, got ${typeof data}`);
    }
    if (data.success === false && !data.error) {
      throw new Error(`Response indicates failure but no error message in ${context}`);
    }
  }

  /**
   * 发送 HTTP 请求
   */
  async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ) {
    const url = `${API_BASE}${endpoint}`;
    const requestHeaders = { 'Content-Type': 'application/json', ...headers };

    console.log(`\n📤 ${method} ${endpoint}`);
    if (data) {
      console.log('Request data:', JSON.stringify(data, null, 2));
    }
    if (headers && Object.keys(headers).length > 0) {
      console.log('Request headers:', Object.keys(headers).join(', '));
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
      });

      const responseData = await response.json();

      console.log(`📥 Response Status: ${response.status}`);
      if (response.status >= 400) {
        console.log('Response Error:', JSON.stringify(responseData, null, 2));
      } else {
        console.log('Response Data:', JSON.stringify(responseData, null, 2));
      }
      console.log('─'.repeat(80));

      return { status: response.status, data: responseData };
    } catch (error: any) {
      console.log(`📥 Request Failed: ${error.message}`);
      console.log('─'.repeat(80));
      throw error;
    }
  }

  /**
   * 清理数据库
   */
  async cleanupDatabase() {
    const startTime = Date.now();
    try {
      // 删除所有配置
      await db.delete(settings);

      // 只删除测试用户
      const testUsers = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.username, 'admin'),
            eq(users.username, testConfig.testData.admin.username),
            eq(users.email, 'admin@test.com'),
            eq(users.email, testConfig.testData.admin.email)
          )
        );

      if (testUsers.length > 0) {
        await db
          .delete(users)
          .where(
            or(
              eq(users.username, 'admin'),
              eq(users.username, testConfig.testData.admin.username),
              eq(users.email, 'admin@test.com'),
              eq(users.email, testConfig.testData.admin.email)
            )
          );
      }

      const duration = Date.now() - startTime;
      this.recordResult('Database Cleanup', true, 'Test data cleaned up', duration);
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult('Database Cleanup', false, 'Failed to clean database', duration, error);
      return false;
    }
  }

  /**
   * 测试系统状态检查
   */
  async testSystemStatus() {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', testConfig.testEndpoints.status);
      this.assertStatus(response.status, 200, 'System Status Check');
      this.assertResponse(response.data, 'System Status Check');

      const statusData = response.data.data;
      this.assert(typeof statusData === 'object', 'Status data should be an object');
      this.assert(typeof statusData.initialized === 'boolean', 'initialized should be boolean');

      const duration = Date.now() - startTime;
      this.recordResult(
        'System Status Check',
        true,
        `System initialized: ${statusData.initialized}`,
        duration,
        undefined,
        statusData
      );
      return statusData;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'System Status Check',
        false,
        'Failed to get system status',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试系统初始化
   */
  async testSystemInitialization() {
    const startTime = Date.now();
    try {
      const initData = {
        site: testConfig.testData.site,
        storage: {
          // 使用真实的 R2 配置而不是测试配置
          endpoint: 'https://9a7e130cdaa8a057ae7869e2f7782d54.r2.cloudflarestorage.com',
          bucket: 'rotedev',
          accessKeyId: '58c216a1ad52886a161ecf543eb1ff77',
          secretAccessKey: '7efffa7524a3a189d47d59a924841ab4f84022391247a0f42d998ae1bc3067d3',
          urlPrefix: 'https://r2dev.rote.ink',
        },
        ui: testConfig.testData.ui,
        admin: testConfig.testData.admin,
      };

      const response = await this.makeRequest('POST', testConfig.testEndpoints.setup, initData);
      this.assertStatus(response.status, 200, 'System Initialization');
      this.assertResponse(response.data, 'System Initialization');

      const initResult = response.data.data;
      this.assert(initResult !== undefined, 'Initialization should return data');
      this.assert(initResult.admin !== undefined, 'Admin user should be created');
      this.assert(
        initResult.admin.username === testConfig.testData.admin.username,
        'Admin username should match'
      );

      const duration = Date.now() - startTime;
      this.recordResult(
        'System Initialization',
        true,
        `Admin user created: ${initResult.admin.username}`,
        duration,
        undefined,
        initResult
      );
      return initResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'System Initialization',
        false,
        'Failed to initialize system',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试登录功能
   */
  async testLogin() {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('POST', testConfig.testEndpoints.login, {
        username: testConfig.testData.admin.username,
        password: testConfig.testData.admin.password,
      });

      this.assertStatus(response.status, 200, 'Login');
      this.assertResponse(response.data, 'Login');

      const loginData = response.data.data;
      this.assert(loginData.accessToken !== undefined, 'Access token should be present');
      this.assert(typeof loginData.accessToken === 'string', 'Access token should be a string');
      this.assert(loginData.accessToken.length > 0, 'Access token should not be empty');

      const duration = Date.now() - startTime;
      this.recordResult('Login', true, 'Login successful', duration, undefined, { hasToken: true });
      return loginData.accessToken;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult('Login', false, 'Login failed', duration, error);
      return null;
    }
  }

  /**
   * 测试配置获取
   */
  async testConfigRetrieval(authToken: string) {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', testConfig.testEndpoints.settings, null, {
        Authorization: `Bearer ${authToken}`,
      });

      this.assertStatus(response.status, 200, 'Config Retrieval');
      this.assertResponse(response.data, 'Config Retrieval');

      const configs = response.data.data;
      this.assert(typeof configs === 'object', 'Configs should be an object');

      const duration = Date.now() - startTime;
      this.recordResult(
        'Config Retrieval',
        true,
        'Configurations retrieved successfully',
        duration,
        undefined,
        configs
      );
      return configs;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult('Config Retrieval', false, 'Failed to get configurations', duration, error);
      return null;
    }
  }

  /**
   * 测试配置更新
   */
  async testConfigUpdate(authToken: string) {
    const startTime = Date.now();
    try {
      const updateData = {
        group: 'site',
        config: {
          name: 'Updated Rote Test',
          url: 'https://updated-test.rote.ink',
          description: 'Updated test site',
          defaultLanguage: 'zh-CN',
        },
      };

      const response = await this.makeRequest(
        'PUT',
        testConfig.testEndpoints.settings,
        updateData,
        {
          Authorization: `Bearer ${authToken}`,
        }
      );

      this.assertStatus(response.status, 200, 'Config Update');
      this.assertResponse(response.data, 'Config Update');

      const updateResult = response.data.data;
      this.assert(updateResult.config !== undefined, 'Update should return config');
      this.assert(
        updateResult.config.name === updateData.config.name,
        'Site name should be updated'
      );

      const duration = Date.now() - startTime;
      this.recordResult(
        'Config Update',
        true,
        `Configuration updated: ${updateResult.config.name}`,
        duration,
        undefined,
        updateResult
      );
      return updateResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult('Config Update', false, 'Failed to update configuration', duration, error);
      return null;
    }
  }

  /**
   * 测试中间件保护
   */
  async testMiddlewareProtection() {
    const startTime = Date.now();
    try {
      // 测试未认证的请求应该被拒绝
      const response = await this.makeRequest('POST', testConfig.testEndpoints.upload, {});
      this.assertStatus(response.status, [401, 403], 'Middleware Protection');

      const duration = Date.now() - startTime;
      this.recordResult(
        'Middleware Protection',
        true,
        'Unauthenticated requests are properly rejected',
        duration
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult('Middleware Protection', false, 'Middleware test failed', duration, error);
      return false;
    }
  }

  /**
   * 测试错误场景
   */
  async testErrorScenarios(authToken: string) {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // 测试无效的配置更新
      const invalidUpdate = {
        group: 'nonexistent',
        config: {},
      };
      const response1 = await this.makeRequest(
        'PUT',
        testConfig.testEndpoints.settings,
        invalidUpdate,
        {
          Authorization: `Bearer ${authToken}`,
        }
      );
      if (response1.status < 400) {
        errors.push('Invalid config group should be rejected');
      }

      // 测试无效的认证令牌
      const response2 = await this.makeRequest('GET', testConfig.testEndpoints.settings, null, {
        Authorization: 'Bearer invalid-token',
      });
      if (response2.status !== 401) {
        errors.push('Invalid token should return 401');
      }

      // 测试无效的登录凭据
      const response3 = await this.makeRequest('POST', testConfig.testEndpoints.login, {
        username: 'nonexistent',
        password: 'wrongpassword',
      });
      if (response3.status !== 401) {
        errors.push('Invalid credentials should return 401');
      }

      const duration = Date.now() - startTime;
      if (errors.length === 0) {
        this.recordResult(
          'Error Scenarios',
          true,
          'All error scenarios handled correctly',
          duration
        );
        return true;
      } else {
        this.recordResult('Error Scenarios', false, errors.join('; '), duration);
        return false;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult('Error Scenarios', false, 'Error scenario test failed', duration, error);
      return false;
    }
  }

  /**
   * 刷新配置缓存
   */
  async refreshCache() {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('POST', '/admin/refresh-cache');
      const duration = Date.now() - startTime;
      if (response.status === 200) {
        this.recordResult('Cache Refresh', true, 'Configuration cache refreshed', duration);
        return true;
      } else {
        this.recordResult('Cache Refresh', false, 'Failed to refresh cache', duration);
        return false;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.recordResult('Cache Refresh', false, 'Cache refresh failed', duration, error);
      return false;
    }
  }

  /**
   * 显示测试摘要
   */
  showSummary() {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 测试结果摘要');
    console.log('='.repeat(80));
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed} ✅`);
    console.log(`失败: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`总耗时: ${totalDuration}ms`);
    console.log(`平均耗时: ${Math.round(totalDuration / total)}ms/测试`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n失败的测试:');
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  ❌ ${r.name}: ${r.message}`);
          if (r.error) {
            console.log(`     错误: ${r.error.message || JSON.stringify(r.error)}`);
          }
        });
    }

    console.log('\n详细测试结果:');
    this.results.forEach((r) => {
      const status = r.success ? '✅' : '❌';
      console.log(`  ${status} ${r.name} (${r.duration}ms): ${r.message}`);
    });
  }

  /**
   * 运行所有测试
   */
  async test() {
    console.log('🚀 Quick Initialization Test\n');
    console.log(`测试目标: ${API_BASE}\n`);

    try {
      // 1. 清理数据库
      await this.cleanupDatabase();

      // 刷新配置缓存
      await this.refreshCache();

      // 2. 检查初始状态
      const initialStatus = await this.testSystemStatus();
      if (!initialStatus) {
        throw new Error('Failed to get initial system status');
      }

      // 3. 初始化系统
      const initResult = await this.testSystemInitialization();
      if (!initResult) {
        throw new Error('System initialization failed');
      }

      // 4. 登录获取 token
      const authToken = await this.testLogin();
      if (!authToken) {
        throw new Error('Login failed');
      }

      // 5. 检查配置
      await this.testConfigRetrieval(authToken);

      // 6. 测试配置中间件
      await this.testMiddlewareProtection();

      // 7. 测试配置更新
      await this.testConfigUpdate(authToken);

      // 8. 测试错误场景
      await this.testErrorScenarios(authToken);

      // 9. 显示摘要
      this.showSummary();

      const allPassed = this.results.every((r) => r.success);
      if (allPassed) {
        console.log('\n🎉 所有测试通过！');
        return true;
      } else {
        console.log('\n⚠️  部分测试失败，请检查上述输出');
        return false;
      }
    } catch (error: any) {
      console.error('\n❌ 测试执行失败:', error);
      this.showSummary();
      return false;
    } finally {
      await closeDatabase();
    }
  }
}

// 运行测试
if (require.main === module) {
  new QuickTester().test().catch(console.error);
}

export { QuickTester };
