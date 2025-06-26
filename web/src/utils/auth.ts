/**
 * JWT Token 管理服务
 * 负责处理访问令牌和刷新令牌的存储、获取和验证
 */
class AuthService {
  private ACCESS_TOKEN_KEY = 'rote_access_token';
  private REFRESH_TOKEN_KEY = 'rote_refresh_token';

  /**
   * 获取访问令牌
   */
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * 获取刷新令牌
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * 存储访问令牌和刷新令牌
   */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  /**
   * 清除所有令牌
   */
  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * 检查令牌是否过期
   * @param token JWT令牌
   * @returns 是否过期
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * 检查当前是否有有效的访问令牌
   */
  hasValidAccessToken(): boolean {
    const token = this.getAccessToken();
    return token !== null && !this.isTokenExpired(token);
  }

  /**
   * 检查当前是否有有效的刷新令牌
   */
  hasValidRefreshToken(): boolean {
    const token = this.getRefreshToken();
    return token !== null && !this.isTokenExpired(token);
  }

  /**
   * 获取令牌中的用户信息
   * @param token JWT令牌
   * @returns 用户信息或null
   */
  getUserInfoFromToken(token: string): { userId: string; username: string } | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        userId: payload.userId,
        username: payload.username,
      };
    } catch {
      return null;
    }
  }

  /**
   * 登出 - 清除所有令牌并可选择刷新页面
   * @param reload 是否刷新页面，默认为 true
   */
  logout(reload: boolean = true): void {
    this.clearTokens();
    if (reload) {
      window.location.reload();
    }
  }
}

export const authService = new AuthService();
