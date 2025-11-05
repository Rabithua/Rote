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
        const isInitialized = response.data?.isInitialized || false;

        setStatus({
          isInitialized,
          isLoading: false,
          error: null,
        });
      } catch (_error) {
        setStatus({
          isInitialized: false,
          isLoading: false,
          error: 'Failed to check system status',
        });
      }
    };

    checkSystemStatus();
  }, []);

  return status;
}
