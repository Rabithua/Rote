/**
 * 测试 HTTP 客户端工具类
 */

export interface ApiResponse<T = any> {
  status: number;
  data: {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
  };
}

export class TestClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * 发送 HTTP 请求
   */
  async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders = { ...this.defaultHeaders, ...headers };

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

      const contentType = response.headers.get('content-type') || '';
      let responseData: any;

      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        // 对于非 JSON 响应（如导出接口），返回文本
        const text = await response.text();
        responseData = { success: response.ok, data: text };
      }

      console.log(`📥 Response Status: ${response.status}`);
      if (response.status >= 400) {
        console.log('❌ Response Error:', JSON.stringify(responseData, null, 2));
        // 提取错误消息以便更好地显示
        const errorMessage = responseData.message || responseData.error || 'Unknown error';
        console.log(`❌ Error Message: ${errorMessage}`);
      } else {
        if (contentType.includes('application/json')) {
          console.log('✅ Response Data:', JSON.stringify(responseData, null, 2));
        } else {
          console.log(
            '✅ Response Data:',
            responseData.data?.substring(0, 200) || responseData.data
          );
        }
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
   * GET 请求
   */
  async get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, headers);
  }

  /**
   * POST 请求
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data, headers);
  }

  /**
   * PUT 请求
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data, headers);
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, data, headers);
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * 清除认证令牌
   */
  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }
}
