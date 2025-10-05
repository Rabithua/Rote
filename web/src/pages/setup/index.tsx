import SetupWizard from '@/components/setup/SetupWizard';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { Loader } from 'lucide-react';
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

  // 状态检查失败则不渲染任何内容（可根据需要改为提示）
  if (error) return null;

  return (
    <div className="bg-pattern min-h-screen">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <SetupWizard />
      </div>
    </div>
  );
}
