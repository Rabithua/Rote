import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { useAuthState } from '@/state/profile';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AiUsagePanel from './AiUsagePanel';

export default function AiUsagePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { authReady, profile } = useAuthState();
  const navigate = useNavigate();

  if (!authReady) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t('accessDenied')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminOnly')}</p>
        </div>
      </div>
    );
  }

  return (
    <ContainerWithSideBar hideSidebarToggleButton>
      <NavBar
        title={t('dashboard.aiUsage.title')}
        icon={<Brain className="size-5" />}
        onBack={() => navigate('/admin')}
      />
      <div className="p-6">
        <AiUsagePanel />
      </div>
    </ContainerWithSideBar>
  );
}
