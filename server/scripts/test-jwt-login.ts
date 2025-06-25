// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

async function testJWTLogin() {
  console.log('🧪 开始测试 JWT 登录 API...');

  const loginData = {
    username: 'rabithua', // 替换为实际的测试用户名
    password: 'password', // 替换为实际的测试密码
  };

  try {
    const response = await fetch('http://localhost:3000/v2/api/auth/jwt-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    console.log('响应状态:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ JWT 登录成功!');
      console.log('用户信息:', data.data.user?.username);
      console.log('Access Token:', data.data.accessToken ? '已生成' : '未生成');
      console.log('Refresh Token:', data.data.refreshToken ? '已生成' : '未生成');

      // 测试 token 解析
      if (data.data.accessToken) {
        const tokenParts = data.data.accessToken.split('.');
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
        console.log('Token 载荷:', payload);
      }
    } else {
      const error = await response.text();
      console.log('❌ 登录失败:', error);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
    console.log('提示：请确保服务器正在运行 (bun run dev)');
  }
}

testJWTLogin();
