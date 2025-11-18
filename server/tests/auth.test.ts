/**
 * 认证相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class AuthTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;
  private baseUrl: string;

  constructor(baseUrl: string, resultManager: TestResultManager) {
    this.baseUrl = baseUrl;
    this.resultManager = resultManager;
    this.client = new TestClient(baseUrl);
  }

  /**
   * 测试登录
   */
  async testLogin(username: string, password: string): Promise<string | null> {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/auth/login', {
        username,
        password,
      });

      TestAssertions.assertStatus(response.status, 200, 'Login');
      TestAssertions.assertSuccess(response.data, 'Login');

      const loginData = response.data.data;
      TestAssertions.assertNotNull(loginData, 'Login data should not be null');
      TestAssertions.assertNotNull(loginData.accessToken, 'Access token should be present');
      TestAssertions.assertNotNull(loginData.refreshToken, 'Refresh token should be present');
      TestAssertions.assertNotNull(loginData.user, 'User data should be present');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Login',
        true,
        `Login successful for ${username}`,
        duration,
        undefined,
        { hasToken: true }
      );

      // 设置认证令牌
      this.client.setAuthToken(loginData.accessToken);

      return loginData.accessToken;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Login', false, 'Login failed', duration, error);
      return null;
    }
  }

  /**
   * 测试注册
   */
  async testRegister(username: string, password: string, email: string, nickname?: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/auth/register', {
        username,
        password,
        email,
        nickname,
      });

      TestAssertions.assertStatus(response.status, 201, 'Register');
      TestAssertions.assertSuccess(response.data, 'Register');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Register', true, `User ${username} registered`, duration);
      return response.data.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Register', false, 'Registration failed', duration, error);
      return null;
    }
  }

  /**
   * 测试刷新令牌
   */
  async testRefreshToken(refreshToken: string): Promise<string | null> {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/auth/refresh', {
        refreshToken,
      });

      TestAssertions.assertStatus(response.status, 200, 'Refresh Token');
      TestAssertions.assertSuccess(response.data, 'Refresh Token');

      const tokenData = response.data.data;
      TestAssertions.assertNotNull(tokenData.accessToken, 'New access token should be present');
      TestAssertions.assertNotNull(tokenData.refreshToken, 'New refresh token should be present');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Refresh Token',
        true,
        'Token refreshed successfully',
        duration
      );

      // 更新认证令牌
      this.client.setAuthToken(tokenData.accessToken);

      return tokenData.accessToken;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Refresh Token',
        false,
        'Token refresh failed',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试修改密码
   */
  async testChangePassword(oldPassword: string, newPassword: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.put('/auth/password', {
        oldpassword: oldPassword,
        newpassword: newPassword,
      });

      TestAssertions.assertStatus(response.status, 200, 'Change Password');
      TestAssertions.assertSuccess(response.data, 'Change Password');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Change Password',
        true,
        'Password changed successfully',
        duration
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Change Password',
        false,
        'Password change failed',
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 测试错误场景
   */
  async testErrorScenarios() {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // 测试无效的登录凭据
      const invalidLogin = await this.client.post('/auth/login', {
        username: 'nonexistent',
        password: 'wrongpassword',
      });
      if (
        invalidLogin.status !== 401 &&
        invalidLogin.status !== 400 &&
        invalidLogin.status !== 404
      ) {
        errors.push('Invalid credentials should return 401, 400, or 404');
      }

      // 测试无效的刷新令牌
      const invalidRefresh = await this.client.post('/auth/refresh', {
        refreshToken: 'invalid-token',
      });
      if (invalidRefresh.status !== 401) {
        errors.push('Invalid refresh token should return 401');
      }

      // 测试缺少必需字段的注册
      const invalidRegister = await this.client.post('/auth/register', {
        username: 'test',
        // 缺少 password 和 email
      });
      // 应该返回 400 错误
      if (invalidRegister.status !== 400) {
        errors.push('Registration without required fields should return 400');
      }

      const duration = Date.now() - startTime;
      if (errors.length === 0) {
        this.resultManager.recordResult(
          'Auth Error Scenarios',
          true,
          'All error scenarios handled correctly',
          duration
        );
        return true;
      } else {
        this.resultManager.recordResult('Auth Error Scenarios', false, errors.join('; '), duration);
        return false;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Auth Error Scenarios',
        false,
        'Error scenario test failed',
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 获取客户端（用于其他测试）
   */
  getClient(): TestClient {
    return this.client;
  }
}
