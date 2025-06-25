// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

async function testRegisterAndJWTLogin() {
  console.log('🧪 开始测试注册和 JWT 登录流程...');
  
  // 生成唯一的测试用户名（限制长度）
  const timestamp = Date.now().toString().slice(-6); // 只取后6位
  const testUser = {
    username: `test${timestamp}`,
    password: 'password123',
    email: `test${timestamp}@example.com`,
    nickname: `测试用户${timestamp}`
  };

  try {
    // 步骤1：注册新用户
    console.log('\n📝 步骤1：注册新用户...');
    const registerResponse = await fetch('http://localhost:3000/v2/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    });

    console.log('注册响应状态:', registerResponse.status);
    
    if (!registerResponse.ok) {
      const registerError = await registerResponse.text();
      console.log('❌ 注册失败:', registerError);
      return;
    }

    const registerData = await registerResponse.json();
    console.log('✅ 注册成功!');
    console.log('新用户ID:', registerData.data?.id);
    console.log('用户名:', registerData.data?.username);

    // 步骤2：使用新注册的账号进行JWT登录
    console.log('\n🔑 步骤2：JWT登录测试...');
    
    const loginData = {
      username: testUser.username,
      password: testUser.password
    };

    const loginResponse = await fetch('http://localhost:3000/v2/api/auth/jwt-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    console.log('JWT登录响应状态:', loginResponse.status);
    
    if (loginResponse.ok) {
      const loginResponseData = await loginResponse.json();
      console.log('✅ JWT 登录成功!');
      console.log('用户信息:', loginResponseData.data.user?.username);
      console.log('Access Token:', loginResponseData.data.accessToken ? '已生成' : '未生成');
      console.log('Refresh Token:', loginResponseData.data.refreshToken ? '已生成' : '未生成');
      
      // 测试 token 解析
      if (loginResponseData.data.accessToken) {
        console.log('\n🔍 Token 分析:');
        const tokenParts = loginResponseData.data.accessToken.split('.');
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
        console.log('Token 载荷:', JSON.stringify(payload, null, 2));
        
        // 步骤3：使用JWT token测试认证接口
        console.log('\n🧪 步骤3：测试JWT认证...');
        await testJWTAuthentication(loginResponseData.data.accessToken);
      }
    } else {
      const loginError = await loginResponse.text();
      console.log('❌ JWT登录失败:', loginError);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    console.log('提示：请确保服务器正在运行 (bun run dev)');
  }
}

async function testJWTAuthentication(token: string) {
  try {
    // 测试JWT认证端点
    const jwtResponse = await fetch('http://localhost:3000/v2/api/auth/test-jwt', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('JWT认证测试响应状态:', jwtResponse.status);
    
    if (jwtResponse.ok) {
      const jwtData = await jwtResponse.json();
      console.log('✅ JWT认证成功！');
      console.log('认证用户名:', jwtData.data?.username);
    } else {
      const error = await jwtResponse.text();
      console.log('❌ JWT认证失败:', error);
    }
  } catch (error) {
    console.error('❌ JWT认证测试失败:', error);
  }
}

testRegisterAndJWTLogin();
