import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { PageMeta } from '@/components/seo/PageMeta';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/state/profile';
import { get } from '@/utils/api';
import { Database, Globe, Settings, Shield, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import OAuthConfigTab from './components/OAuthConfigTab';
import SiteConfigTab from './components/SiteConfigTab';
import StorageConfigTab from './components/StorageConfigTab';
import UIConfigTab from './components/UIConfigTab';
import UsersTab from './components/UsersTab';
import type { SystemConfig } from './types';

export default function AdminDashboard() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const profile = useProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'site' | 'storage' | 'ui' | 'oauth' | 'users'>('site');

  const {
    data: configs,
    isLoading,
    mutate,
  } = useSWR<SystemConfig>(
    profile?.role === 'admin' || profile?.role === 'super_admin' ? '/admin/settings' : null,
    async () => {
      const res = await get('/admin/settings');
      // 后端返回的是 { site: {...}, storage: {...}, ui: {...} } 格式
      return res.data as SystemConfig;
    }
  );

  const [siteConfig, setSiteConfig] = useState<SystemConfig['site'] | undefined>(undefined);
  const [storageConfig, setStorageConfig] = useState<SystemConfig['storage'] | undefined>(
    undefined
  );
  const [uiConfig, setUiConfig] = useState<SystemConfig['ui'] | undefined>(undefined);
  const [securityConfig, setSecurityConfig] = useState<SystemConfig['security'] | undefined>(
    undefined
  );

  useEffect(() => {
    if (configs) {
      if (configs.site) setSiteConfig(configs.site);
      // 存储配置可能为空，初始化为空对象以便用户添加配置
      setStorageConfig(
        configs.storage || {
          endpoint: '',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          urlPrefix: '',
        }
      );
      // UI 配置可能为空，初始化为默认值
      setUiConfig(
        configs.ui || {
          allowRegistration: true,
          allowUploadFile: true,
          defaultUserRole: 'user',
          apiRateLimit: 100,
        }
      );
      setSecurityConfig(
        configs.security || {
          requireVerifiedEmailForExplore: false,
        }
      );
    }
  }, [configs]);

  // 检查用户是否有管理员权限
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

  if (isLoading) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

  return (
    <>
      {/* 功能型页面：使用站点默认信息 + robots noindex */}
      <PageMeta robots="noindex, nofollow" />

      <div className="noScrollBar relative flex-1 divide-y overflow-x-hidden overflow-y-visible pb-20">
        <NavBar title={t('title')} icon={<Shield className="size-6" />} />

        <div className="flex flex-col divide-y">
          {/* Tab 导航 */}
          <div className="noScrollBar flex divide-x overflow-x-scroll">
            <Button
              variant={activeTab === 'site' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('site')}
              className="flex items-center gap-2 rounded-none"
            >
              <Globe className="size-4" />
              {t('tabs.site')}
            </Button>
            <Button
              variant={activeTab === 'storage' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('storage')}
              className="flex items-center gap-2 rounded-none"
            >
              <Database className="size-4" />
              {t('tabs.storage')}
            </Button>
            <Button
              variant={activeTab === 'ui' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('ui')}
              className="flex items-center gap-2 rounded-none"
            >
              <Settings className="size-4" />
              {t('tabs.ui')}
            </Button>
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('users')}
              className="flex items-center gap-2 rounded-none"
            >
              <Users className="size-4" />
              {t('tabs.users')}
            </Button>
            <Button
              variant={activeTab === 'oauth' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('oauth')}
              className="flex items-center gap-2 rounded-none"
            >
              <Shield className="size-4" />
              {t('tabs.oauth')}
            </Button>
          </div>

          {/* 站点配置 */}
          {activeTab === 'site' && (
            <SiteConfigTab
              siteConfig={siteConfig}
              setSiteConfig={setSiteConfig}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onMutate={mutate}
            />
          )}

          {/* 存储配置 */}
          {activeTab === 'storage' && (
            <StorageConfigTab
              storageConfig={storageConfig}
              setStorageConfig={setStorageConfig}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              isTesting={isTesting}
              setIsTesting={setIsTesting}
              onMutate={mutate}
            />
          )}

          {/* UI 配置 */}
          {activeTab === 'ui' && (
            <UIConfigTab
              uiConfig={uiConfig}
              setUiConfig={setUiConfig}
              securityConfig={securityConfig}
              setSecurityConfig={setSecurityConfig}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onMutate={mutate}
            />
          )}

          {/* OAuth 配置 */}
          {activeTab === 'oauth' && (
            <OAuthConfigTab
              securityConfig={securityConfig}
              setSecurityConfig={setSecurityConfig}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onMutate={mutate}
            />
          )}

          {/* 用户管理 */}
          {activeTab === 'users' && <UsersTab />}
        </div>
      </div>
    </>
  );
}
