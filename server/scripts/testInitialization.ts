/**
 * 后端初始化过程测试脚本
 * 测试从系统未初始化到完全配置好的整个流程
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
  data?: any;
  error?: any;
}

class InitializationTester {
  private results: TestResult[] = [];

  constructor() {}

  /**
   * 记录测试结果
   */
  private recordResult(name: string, success: boolean, message: string, data?: any, error?: any) {
    this.results.push({ name, success, message, data, error });
    const status = success ? '✅' : '❌';
    console.log(`${status} ${name}: ${message}`);
    if (error) {
      console.log(`   Error: ${error.message || error}`);
    }
  }

  /**
   * 发送 HTTP 请求
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ) {
    const url = `${API_BASE}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    return {
      status: response.status,
      data: result,
    };
  }

  /**
   * 清理数据库配置
   */
  async cleanupDatabase() {
    try {
      await db.delete(settings);
      // 只删除测试用户
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
      this.recordResult('Cleanup', true, 'Database configuration and test users cleaned up');

      // 刷新配置缓存
      try {
        await this.makeRequest('POST', '/admin/refresh-cache');
        this.recordResult('Cache Refresh', true, 'Configuration cache refreshed');
      } catch (_error) {
        this.recordResult(
          'Cache Refresh',
          false,
          'Failed to refresh configuration cache',
          null,
          _error
        );
      }
    } catch (error) {
      this.recordResult('Cleanup', false, 'Failed to clean up database', null, error);
    }
  }

  /**
   * 测试系统状态检查
   */
  async testSystemStatus() {
    try {
      const response = await this.makeRequest('GET', testConfig.testEndpoints.status);

      if (response.status === 200) {
        const { data } = response.data;
        this.recordResult('System Status Check', true, 'System status retrieved', {
          initialized: data.initialized,
          missingConfigs: data.missingConfigs,
          databaseConnected: data.databaseConnected,
          hasAdminUser: data.hasAdminUser,
        });
        return data;
      } else {
        this.recordResult(
          'System Status Check',
          false,
          'Failed to get system status',
          null,
          response.data
        );
        return null;
      }
    } catch (error) {
      this.recordResult('System Status Check', false, 'Error checking system status', null, error);
      return null;
    }
  }

  /**
   * 测试系统初始化
   */
  async testSystemInitialization() {
    // 使用配置文件中的测试数据，但使用真实的 R2 配置
    const setupData = {
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

    try {
      const response = await this.makeRequest('POST', testConfig.testEndpoints.setup, setupData);

      if (response.status === 200) {
        this.recordResult('System Initialization', true, 'System initialized successfully', {
          site: response.data.data.site,
          admin: response.data.data.admin,
          keys: response.data.data.keys,
        });
        return response.data.data;
      } else {
        this.recordResult(
          'System Initialization',
          false,
          'Failed to initialize system',
          null,
          response.data
        );
        return null;
      }
    } catch (error) {
      this.recordResult(
        'System Initialization',
        false,
        'Error during system initialization',
        null,
        error
      );
      return null;
    }
  }

  /**
   * 测试配置获取
   */
  async testConfigRetrieval(authToken?: string) {
    try {
      const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

      // 测试获取所有配置
      const allConfigsResponse = await this.makeRequest(
        'GET',
        testConfig.testEndpoints.settings,
        undefined,
        authHeaders
      );

      if (allConfigsResponse.status === 200) {
        this.recordResult(
          'Get All Configs',
          true,
          'All configurations retrieved',
          allConfigsResponse.data.data
        );
      } else {
        this.recordResult(
          'Get All Configs',
          false,
          'Failed to get all configurations',
          null,
          allConfigsResponse.data
        );
      }

      // 测试获取特定配置
      const siteConfigResponse = await this.makeRequest(
        'GET',
        `${testConfig.testEndpoints.settings}?group=site`,
        undefined,
        authHeaders
      );

      if (siteConfigResponse.status === 200) {
        this.recordResult(
          'Get Site Config',
          true,
          'Site configuration retrieved',
          siteConfigResponse.data.data
        );
      } else {
        this.recordResult(
          'Get Site Config',
          false,
          'Failed to get site configuration',
          null,
          siteConfigResponse.data
        );
      }
    } catch (error) {
      this.recordResult('Config Retrieval', false, 'Error retrieving configurations', null, error);
    }
  }

  /**
   * 测试配置更新
   */
  async testConfigUpdate(authToken?: string) {
    const updatedSiteConfig = {
      group: 'site',
      config: {
        name: 'Updated Rote Test Site',
        url: 'https://updated-test.rote.ink',
        description: 'Updated test site description',
        defaultLanguage: 'zh-CN',
        apiUrl: 'https://api.updated-test.rote.ink',
        frontendUrl: 'https://updated-test.rote.ink',
      },
    };

    try {
      const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const response = await this.makeRequest(
        'PUT',
        testConfig.testEndpoints.settings,
        updatedSiteConfig,
        authHeaders
      );

      if (response.status === 200) {
        this.recordResult(
          'Config Update',
          true,
          'Configuration updated successfully',
          response.data.data
        );
      } else {
        this.recordResult(
          'Config Update',
          false,
          'Failed to update configuration',
          null,
          response.data
        );
      }
    } catch (error) {
      this.recordResult('Config Update', false, 'Error updating configuration', null, error);
    }
  }

  /**
   * 测试配置连接测试
   */
  async testConfigTesting(authToken?: string) {
    const storageTestData = {
      type: 'storage',
      config: {
        endpoint: 'https://test-account.r2.cloudflarestorage.com',
        bucket: 'test-bucket',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        urlPrefix: 'https://test.example.com',
      },
    };

    try {
      const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const response = await this.makeRequest(
        'POST',
        testConfig.testEndpoints.testConfig,
        storageTestData,
        authHeaders
      );

      if (response.status === 200) {
        this.recordResult(
          'Storage Config Test',
          true,
          'Storage configuration test completed',
          response.data.data
        );
      } else {
        this.recordResult(
          'Storage Config Test',
          false,
          'Storage configuration test failed',
          null,
          response.data
        );
      }
    } catch (error) {
      this.recordResult(
        'Storage Config Test',
        false,
        'Error testing storage configuration',
        null,
        error
      );
    }
  }

  /**
   * 测试 URL 检测和更新
   */
  async testUrlDetection(authToken?: string) {
    try {
      const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

      // 测试 URL 检测
      const detectResponse = await this.makeRequest(
        'GET',
        testConfig.testEndpoints.detectUrls,
        undefined,
        authHeaders
      );

      if (detectResponse.status === 200) {
        this.recordResult(
          'URL Detection',
          true,
          'URLs detected successfully',
          detectResponse.data.data
        );
      } else {
        this.recordResult(
          'URL Detection',
          false,
          'Failed to detect URLs',
          null,
          detectResponse.data
        );
      }

      // 测试 URL 更新
      const updateUrlData = {
        apiUrl: 'https://api.test.rote.ink',
        frontendUrl: 'https://test.rote.ink',
      };

      const updateResponse = await this.makeRequest(
        'POST',
        testConfig.testEndpoints.updateUrls,
        updateUrlData,
        authHeaders
      );

      if (updateResponse.status === 200) {
        this.recordResult(
          'URL Update',
          true,
          'URLs updated successfully',
          updateResponse.data.data
        );
      } else {
        this.recordResult('URL Update', false, 'Failed to update URLs', null, updateResponse.data);
      }
    } catch (error) {
      this.recordResult('URL Management', false, 'Error managing URLs', null, error);
    }
  }

  /**
   * 测试配置中间件
   */
  async testConfigMiddleware() {
    try {
      // 测试存储配置中间件（应该成功，因为我们已经配置了存储）
      const uploadResponse = await this.makeRequest('POST', testConfig.testEndpoints.upload, {});

      if (uploadResponse.status === 503) {
        this.recordResult(
          'Storage Middleware (No Auth)',
          true,
          'Storage middleware correctly blocked request without auth'
        );
      } else if (uploadResponse.status === 401) {
        this.recordResult(
          'Storage Middleware (No Auth)',
          true,
          'Storage middleware passed, auth middleware blocked (expected)'
        );
      } else {
        this.recordResult(
          'Storage Middleware (No Auth)',
          false,
          'Unexpected response from storage middleware',
          null,
          uploadResponse.data
        );
      }

      // 测试安全配置中间件（应该成功，因为我们已经配置了安全）
      const loginResponse = await this.makeRequest('POST', testConfig.testEndpoints.login, {
        username: testConfig.testData.admin.username,
        password: testConfig.testData.admin.password,
      });

      if (loginResponse.status === 200) {
        this.recordResult(
          'Security Middleware (Login)',
          true,
          'Security middleware allowed login with valid credentials'
        );
        return loginResponse.data.data; // 返回 token 用于后续测试
      } else {
        this.recordResult(
          'Security Middleware (Login)',
          false,
          'Login failed',
          null,
          loginResponse.data
        );
        return null;
      }
    } catch (error) {
      this.recordResult(
        'Config Middleware',
        false,
        'Error testing configuration middleware',
        null,
        error
      );
      return null;
    }
  }

  /**
   * 测试热更新功能
   */
  async testHotUpdate(authToken?: string) {
    try {
      // 更新存储配置
      const updatedStorageConfig = {
        group: 'storage',
        config: {
          endpoint: 'https://updated-test-account.r2.cloudflarestorage.com',
          bucket: 'updated-test-bucket',
          accessKeyId: 'updated-test-access-key',
          secretAccessKey: 'updated-test-secret-key',
          urlPrefix: 'https://updated-test.example.com',
        },
      };

      const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const response = await this.makeRequest(
        'PUT',
        testConfig.testEndpoints.settings,
        updatedStorageConfig,
        authHeaders
      );

      if (response.status === 200) {
        this.recordResult(
          'Hot Update',
          true,
          'Configuration hot update successful',
          response.data.data
        );
      } else {
        this.recordResult(
          'Hot Update',
          false,
          'Failed to hot update configuration',
          null,
          response.data
        );
      }
    } catch (error) {
      this.recordResult('Hot Update', false, 'Error during hot update', null, error);
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 Starting Rote Backend Initialization Tests\n');
    console.log(`Testing against: ${API_BASE}\n`);

    // 1. 清理数据库
    await this.cleanupDatabase();

    // 2. 测试系统状态
    const _status = await this.testSystemStatus();

    // 3. 测试系统初始化
    const _initResult = await this.testSystemInitialization();

    // 4. 测试配置中间件（获取认证令牌）
    const token = await this.testConfigMiddleware();

    // 5. 测试配置获取
    await this.testConfigRetrieval(token?.accessToken);

    // 6. 测试配置更新
    await this.testConfigUpdate(token?.accessToken);

    // 7. 测试配置连接测试
    await this.testConfigTesting(token?.accessToken);

    // 8. 测试 URL 检测和更新
    await this.testUrlDetection(token?.accessToken);

    // 9. 测试热更新功能
    await this.testHotUpdate(token?.accessToken);

    // 10. 显示测试结果摘要
    this.showSummary();
  }

  /**
   * 显示测试结果摘要
   */
  showSummary() {
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));

    const total = this.results.length;
    const passed = this.results.filter((r) => r.success).length;
    const failed = total - passed;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.name}: ${r.message}`);
          if (r.error) {
            console.log(`    Error: ${r.error.message || r.error}`);
          }
        });
    }

    console.log('\n🎉 Initialization testing completed!');
  }

  /**
   * 清理资源
   */
  async cleanup() {
    await closeDatabase();
  }
}

// 运行测试
async function main() {
  const tester = new InitializationTester();

  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    await tester.cleanup();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

export { InitializationTester };
