import SetupWizard from '@/components/setup/SetupWizard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

export default function SetupPage() {
  const { isInitialized, isLoading, error } = useSystemStatus();
  const { t } = useTranslation('translation', { keyPrefix: 'pages.setupPage' });

  if (isLoading) {
    return (
      <div className="bg-pattern relative flex h-screen flex-col items-center justify-center gap-2">
        <Loader className="size-5 animate-spin" />
        <p className="text-muted-foreground text-sm">{t('statusChecking')}</p>
      </div>
    );
  }

  // 已初始化则禁止访问该页面，统一跳转到根路径
  if (isInitialized) {
    return <Navigate to="/" replace />;
  }

  // 处理错误情况，显示错误提示
  if (error) {
    // 判断是否是网络连接错误
    const networkErrorKeywords = [
      'not responding',
      'ECONNREFUSED',
      'ERR_NETWORK',
      'Network Error',
      'timeout',
    ];
    const isNetworkError = networkErrorKeywords.some((keyword) => error.includes(keyword));

    return (
      <div className="bg-pattern min-h-screen">
        <div className="font-zhengwen container mx-auto max-w-2xl px-4 py-8">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>{t('error.title')}</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{t('error.description')}</p>
              <p className="font-mono text-sm opacity-80">{error}</p>
              {isNetworkError && <p className="mt-2 text-sm">{t('error.backendHint')}</p>}
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="mr-2 size-4" />
                {t('error.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-pattern min-h-screen">
      <div className="font-zhengwen container mx-auto max-w-2xl px-4 py-8">
        <SetupWizard />
      </div>
    </div>
  );
}
