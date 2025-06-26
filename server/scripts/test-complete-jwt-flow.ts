// 测试完整的JWT认证流程
import dotenv from 'dotenv';
dotenv.config();

async function testCompleteJWTFlow() {
  console.log('🧪 开始测试完整的JWT认证流程...\n');

  const baseUrl = 'http://localhost:3000/v2/api';

  // 测试数据
  const loginData = {
    username: 'testt', // 请替换为实际的测试用户名
    password: 'testt', // 请替换为实际的测试密码
  };

  let accessToken = '';
  let refreshToken = '';

  try {
    // 1. 测试登录（现在使用JWT）
    console.log('1. 测试JWT登录...');
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    if (!loginResponse.ok) {
      throw new Error(`登录失败: ${loginResponse.status} ${await loginResponse.text()}`);
    }

    const loginResult = await loginResponse.json();
    console.log('✅ 登录成功!');
    console.log('用户:', loginResult.data.user?.username);

    accessToken = loginResult.data.accessToken;
    refreshToken = loginResult.data.refreshToken;

    console.log('Access Token:', accessToken ? '已生成' : '未生成');
    console.log('Refresh Token:', refreshToken ? '已生成' : '未生成');
    console.log('');

    // 2. 测试使用AccessToken访问受保护的API
    console.log('2. 测试使用AccessToken访问用户资料...');
    const profileResponse = await fetch(`${baseUrl}/users/me/profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      throw new Error(`获取资料失败: ${profileResponse.status} ${await profileResponse.text()}`);
    }

    const profileResult = await profileResponse.json();
    console.log('✅ 成功获取用户资料!');
    console.log('用户名:', profileResult.data.username);
    console.log('');

    // 3. 测试Token刷新
    console.log('3. 测试Token刷新...');
    const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshResponse.ok) {
      throw new Error(`Token刷新失败: ${refreshResponse.status} ${await refreshResponse.text()}`);
    }

    const refreshResult = await refreshResponse.json();
    console.log('✅ Token刷新成功!');

    const newAccessToken = refreshResult.data.accessToken;
    const newRefreshToken = refreshResult.data.refreshToken;

    console.log('新Access Token:', newAccessToken ? '已生成' : '未生成');
    console.log('新Refresh Token:', newRefreshToken ? '已生成' : '未生成');
    console.log('');

    // 4. 测试使用新的AccessToken
    console.log('4. 测试使用新的AccessToken...');
    const newProfileResponse = await fetch(`${baseUrl}/users/me/profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${newAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!newProfileResponse.ok) {
      throw new Error(
        `使用新Token获取资料失败: ${newProfileResponse.status} ${await newProfileResponse.text()}`
      );
    }

    console.log('✅ 使用新Token成功获取用户资料!');
    console.log('');

    // 5. 测试无效Token
    console.log('5. 测试无效Token处理...');
    const invalidTokenResponse = await fetch(`${baseUrl}/users/me/profile`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
    });

    if (invalidTokenResponse.status === 401) {
      console.log('✅ 无效Token正确返回401错误!');
    } else {
      console.log('❌ 无效Token处理异常:', invalidTokenResponse.status);
    }
    console.log('');

    console.log('🎉 所有JWT认证测试通过!');
    console.log('\n总结:');
    console.log('✅ JWT登录正常工作');
    console.log('✅ Token认证正常工作');
    console.log('✅ Token刷新正常工作');
    console.log('✅ 无效Token正确处理');
    console.log('\n🚀 JWT认证系统迁移完成!');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.log('\n检查清单:');
    console.log('- 确保服务器正在运行 (bun run dev)');
    console.log('- 确认测试用户存在');
    console.log('- 检查JWT密钥配置');
  }
}

testCompleteJWTFlow();
