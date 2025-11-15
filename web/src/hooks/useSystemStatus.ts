import { getConfigStatus } from '@/utils/setupApi';
import { useEffect, useState } from 'react';

interface SystemStatus {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>({
    isInitialized: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await getConfigStatus();

        // 验证响应格式
        if (!response || typeof response !== 'object' || !('data' in response)) {
          throw new Error('Invalid response format: missing required fields');
        }

        const { data } = response;

        // 检查 data 字段的有效性
        if (!data || typeof data !== 'object' || !('isInitialized' in data)) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[useSystemStatus] Invalid response data:', response);
          }
          throw new Error('Invalid response format: missing isInitialized field');
        }

        const isInitialized = Boolean(data.isInitialized);

        setStatus({
          isInitialized,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        // 记录错误日志
        // eslint-disable-next-line no-console
        console.error('[useSystemStatus] Failed to check system status:', error);

        // 捕获更详细的错误信息
        let errorMessage = 'Failed to check system status';
        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
          // eslint-disable-next-line no-console
          console.error('[useSystemStatus] Backend error message:', error.response.data.message);
        } else if (error?.message) {
          errorMessage = error.message;
          // eslint-disable-next-line no-console
          console.error('[useSystemStatus] Error message:', error.message);
        } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ERR_NETWORK') {
          errorMessage = 'Backend service is not responding';
          // eslint-disable-next-line no-console
          console.error('[useSystemStatus] Network error:', error.code);
        }

        // 记录完整的错误对象（仅在开发环境）
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[useSystemStatus] Full error object:', error);
        }

        setStatus({
          isInitialized: false,
          isLoading: false,
          error: errorMessage,
        });
      }
    };

    checkSystemStatus();
  }, []);

  return status;
}
