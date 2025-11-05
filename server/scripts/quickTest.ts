/**
 * 快速初始化测试脚本
 * 用于快速验证系统初始化流程
 */

import { PrismaClient } from '@prisma/client';
import testConfig from './testConfig.json';

const BASE_URL = process.env.TEST_BASE_URL || testConfig.testSettings.baseUrl;
const API_BASE = `${BASE_URL}${testConfig.testSettings.apiBase}/api`;

class QuickTester {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

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
    if (headers) {
      console.log('Request headers:', JSON.stringify(headers, null, 2));
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });

    const responseData = await response.json();

    console.log(`📥 Response Status: ${response.status}`);
    console.log('Response Data:', JSON.stringify(responseData, null, 2));
    console.log('─'.repeat(80));

    return { status: response.status, data: responseData };
  }

  async test() {
    console.log('🚀 Quick Initialization Test\n');

    try {
      // 1. 清理数据库
      console.log('1. Cleaning up database...');
      await this.prisma.setting.deleteMany();
      // 只删除测试用户
      await this.prisma.user.deleteMany({
        where: {
          OR: [
            { username: 'admin' },
            { username: 'testadmin' },
            { email: 'admin@test.com' },
            { email: 'testadmin@test.com' },
          ],
        },
      });
      console.log('✅ Database cleaned up');

      // 刷新配置缓存
      console.log('   Refreshing configuration cache...');
      const refreshResponse = await this.makeRequest('POST', '/admin/refresh-cache');
      if (refreshResponse.status === 200) {
        console.log('✅ Configuration cache refreshed\n');
      } else {
        console.log('❌ Configuration cache refresh failed\n');
      }

      // 2. 检查初始状态
      console.log('2. Checking initial system status...');
      const statusResponse = await this.makeRequest('GET', testConfig.testEndpoints.status);
      if (statusResponse.status === 200) {
        console.log(`✅ System status retrieved`);
        console.log(`Initialized: ${statusResponse.data.data?.initialized || false}`);
        console.log(
          `Missing configs: ${statusResponse.data.data?.missingConfigs?.join(', ') || 'None'}\n`
        );
      } else {
        console.log('❌ Failed to get system status\n');
      }

      // 3. 初始化系统
      console.log('3. Initializing system...');

      // 使用配置文件中的测试数据，但使用真实的 R2 配置
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

      const initResponse = await this.makeRequest('POST', testConfig.testEndpoints.setup, initData);
      if (initResponse.status === 200) {
        console.log('✅ System initialized successfully');
        const responseData = initResponse.data.data;
        if (responseData.admin) {
          console.log(`Admin user: ${responseData.admin.username}`);
        }
        if (responseData.site) {
          console.log(`Site name: ${responseData.site.name}`);
        }
        console.log('');
      } else {
        console.log('❌ System initialization failed');
        return;
      }

      // 4. 登录获取 token
      console.log('4. Logging in to get authentication token...');
      const loginResponse = await this.makeRequest('POST', testConfig.testEndpoints.login, {
        username: testConfig.testData.admin.username,
        password: testConfig.testData.admin.password,
      });

      let authToken = '';
      if (loginResponse.status === 200) {
        authToken = loginResponse.data.data.accessToken;
        console.log('✅ Login successful');
      } else {
        console.log('❌ Login failed');
        return;
      }

      // 5. 检查配置
      console.log('5. Checking configurations...');
      const configResponse = await this.makeRequest(
        'GET',
        testConfig.testEndpoints.settings,
        null,
        {
          Authorization: `Bearer ${authToken}`,
        }
      );
      if (configResponse.status === 200) {
        const configs = configResponse.data.data;
        console.log('✅ Configurations retrieved:');
        console.log(`  - Site: ${configs.site?.name || 'Not set'}`);
        console.log(`  - Storage: ${configs.storage?.bucket || 'Not set'}`);
        console.log(`  - Security: ${configs.security?.jwtSecret ? 'Configured' : 'Not set'}`);
        console.log(`  - UI: ${configs.ui?.allowRegistration ? 'Configured' : 'Not set'}\n`);
      } else {
        console.log('❌ Failed to get configurations');
        return;
      }

      // 6. 测试配置中间件
      console.log('6. Testing configuration middleware...');

      // 测试存储中间件（应该被认证中间件拦截）
      const uploadResponse = await this.makeRequest('POST', testConfig.testEndpoints.upload, {});
      if (uploadResponse.status === 401) {
        console.log('✅ Storage middleware working (auth required)');
      } else {
        console.log(`⚠️  Unexpected upload response: ${uploadResponse.status}`);
      }

      // 7. 测试配置更新
      console.log('7. Testing configuration update...');
      const updateData = {
        group: 'site',
        config: {
          name: 'Updated Rote Test',
          url: 'https://updated-test.rote.ink',
          description: 'Updated test site',
          defaultLanguage: 'zh-CN',
        },
      };

      const updateResponse = await this.makeRequest(
        'PUT',
        testConfig.testEndpoints.settings,
        updateData,
        {
          Authorization: `Bearer ${authToken}`,
        }
      );
      if (updateResponse.status === 200) {
        console.log('✅ Configuration updated successfully');
        console.log(`New site name: ${updateResponse.data.data.config.name}\n`);
      } else {
        console.log('❌ Configuration update failed');
      }

      console.log('🎉 Quick test completed successfully!');
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

// 运行测试
if (require.main === module) {
  new QuickTester().test().catch(console.error);
}

export { QuickTester };
