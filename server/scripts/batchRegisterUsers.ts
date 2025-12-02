/**
 * 批量注册用户测试脚本
 * 直接调用现有的注册接口批量创建测试用户
 */

import testConfig from './testConfig.json';

const BASE_URL = process.env.TEST_BASE_URL || testConfig.testSettings.baseUrl;
const API_BASE = `${BASE_URL}${testConfig.testSettings.apiBase}/api`;

interface RegisterResult {
  username: string;
  success: boolean;
  message: string;
  error?: string;
}

/**
 * 批量注册用户
 */
async function batchRegisterUsers(count: number = 10) {
  const results: RegisterResult[] = [];
  const password = 'test123456'; // 统一的测试密码

  console.log(`🚀 开始批量注册 ${count} 个用户...\n`);
  console.log(`API 地址: ${API_BASE}/auth/register\n`);

  for (let i = 1; i <= count; i++) {
    const username = `testuser${i}`;
    const email = `testuser${i}@test.com`;
    const nickname = `测试用户 ${i}`;

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
          nickname,
        }),
      });

      let data: any;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (_parseError) {
        results.push({
          username,
          success: false,
          message: `注册失败: 响应解析错误`,
          error: 'Invalid JSON response',
        });
        console.log(`❌ [${i}/${count}] ${username} - 注册失败: 响应解析错误`);
        continue;
      }

      // 检查响应：成功时 code 为 0，HTTP 状态码为 201
      if (response.ok && (response.status === 201 || response.status === 200) && data.code === 0) {
        results.push({
          username,
          success: true,
          message: `用户 ${username} 注册成功`,
        });
        console.log(`✅ [${i}/${count}] ${username} - 注册成功`);
      } else {
        const errorMsg = data.message || `HTTP ${response.status}`;
        results.push({
          username,
          success: false,
          message: `注册失败: ${errorMsg}`,
          error: errorMsg,
        });
        console.log(`❌ [${i}/${count}] ${username} - 注册失败: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Network error';
      results.push({
        username,
        success: false,
        message: `注册失败: ${errorMsg}`,
        error: errorMsg,
      });
      console.log(`❌ [${i}/${count}] ${username} - 注册失败: ${errorMsg}`);
    }

    // 添加小延迟，避免请求过快
    if (i < count) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 显示摘要
  console.log('\n' + '='.repeat(80));
  console.log('📊 批量注册结果摘要');
  console.log('='.repeat(80));
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  console.log(`总用户数: ${count}`);
  console.log(`成功: ${successCount} ✅`);
  console.log(`失败: ${failCount} ${failCount > 0 ? '❌' : ''}`);
  console.log('='.repeat(80));

  if (failCount > 0) {
    console.log('\n失败的注册:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  ❌ ${r.username}: ${r.error || r.message}`);
      });
  }

  console.log('\n✅ 批量注册完成！');
  console.log(`所有用户密码: ${password}`);
  console.log(`用户名格式: testuser1, testuser2, ..., testuser${count}`);
  console.log(`邮箱格式: testuser1@test.com, testuser2@test.com, ..., testuser${count}@test.com`);

  return results;
}

// 运行脚本
if (require.main === module) {
  const count = process.argv[2] ? parseInt(process.argv[2], 10) : 10;
  if (isNaN(count) || count <= 0) {
    console.error('❌ 错误: 用户数量必须是正整数');
    console.log('用法: bun run scripts/batchRegisterUsers.ts [数量]');
    console.log('示例: bun run scripts/batchRegisterUsers.ts 20');
    process.exit(1);
  }

  batchRegisterUsers(count)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

export { batchRegisterUsers };
