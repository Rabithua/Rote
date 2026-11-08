import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { Button } from '@/components/ui/button';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { useAuthState } from '@/state/profile';
import { get } from '@/utils/api';
import {
  Activity,
  BellRing,
  Brain,
  Database,
  Globe,
  KeyRound,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import AIConfigTab from './components/AIConfigTab';
import OAuthConfigTab from './components/OAuthConfigTab';
import PermissionsTab from './components/PermissionsTab';
import SiteConfigTab from './components/SiteConfigTab';
import StorageConfigTab from './components/StorageConfigTab';
import UIConfigTab from './components/UIConfigTab';
import UpdateBanner from './components/UpdateBanner';
import UsersTab from './components/UsersTab';
import DashboardTab from './components/DashboardTab';
import HooksConfigTab from './components/HooksConfigTab';
import UnsavedSettingsDialog from './settings/UnsavedSettingsDialog';
import { useAdminNavigationGuard } from './settings/useAdminNavigationGuard';
import { useAdminSettingsDrafts } from './settings/useAdminSettingsDrafts';
import type { SystemConfig } from './types';

export default function AdminDashboard() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { authReady, profile } = useAuthState();
  const canManageSettings =
    authReady && (profile?.role === 'admin' || profile?.role === 'super_admin');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [hooksDirty, setHooksDirty] = useState(false);
  const [autosaveDirty, setAutosaveDirty] = useState(false);
  const [autosaveSaving, setAutosaveSaving] = useState(false);
  const [userPermissionsDirty, setUserPermissionsDirty] = useState(false);
  const [userPermissionsSaving, setUserPermissionsSaving] = useState(false);
  const isNavigationLocked =
    isSaving || permissionsSaving || autosaveSaving || userPermissionsSaving;
  const [activeTab, setActiveTab] = useState<
    'ai' | 'dashboard' | 'hooks' | 'oauth' | 'permissions' | 'site' | 'storage' | 'ui' | 'users'
  >('dashboard');

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

  const drafts = useAdminSettingsDrafts(configs);
  const navigation = useAdminNavigationGuard({
    activeTab,
    hasUnsavedChanges:
      canManageSettings &&
      (drafts.hasUnsavedChanges || hooksDirty || autosaveDirty || userPermissionsDirty),
    isSaving: canManageSettings && isNavigationLocked,
    onDiscard: drafts.discard,
    onTabChange: setActiveTab,
  });
  const securityConfig = drafts.security.value;

  if (!authReady) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

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
    <ContainerWithSideBar viewport scrollContainerName="#admin-settings-scroll">
      <div className="shrink-0">
        <NavBar title={t('title')} icon={<Shield className="size-5" />} />
        <UpdateBanner />
      </div>

      <div className="flex min-h-0 flex-1 flex-col divide-y">
        {/* Tab 导航 */}
        <div className="noScrollBar flex shrink-0 divide-x overflow-x-scroll">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('dashboard')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <Activity className="size-4" />
            {t('tabs.dashboard', 'Dashboard')}
          </Button>
          <Button
            variant={activeTab === 'site' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('site')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <Globe className="size-4" />
            {t('tabs.site')}
          </Button>
          <Button
            variant={activeTab === 'storage' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('storage')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <Database className="size-4" />
            {t('tabs.storage')}
          </Button>
          <Button
            variant={activeTab === 'ui' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('ui')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <Settings className="size-4" />
            {t('tabs.ui')}
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('users')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <Users className="size-4" />
            {t('tabs.users')}
          </Button>
          <Button
            variant={activeTab === 'permissions' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('permissions')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <KeyRound className="size-4" />
            {t('tabs.permissions')}
          </Button>
          <Button
            variant={activeTab === 'ai' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('ai')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <Brain className="size-4" />
            {t('tabs.ai')}
          </Button>
          <Button
            variant={activeTab === 'hooks' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('hooks')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <BellRing className="size-4" />
            {t('tabs.hooks')}
          </Button>
          <Button
            variant={activeTab === 'oauth' ? 'default' : 'ghost'}
            onClick={() => navigation.requestTabChange('oauth')}
            disabled={isNavigationLocked}
            className="flex items-center gap-2 rounded-none"
          >
            <Shield className="size-4" />
            {t('tabs.oauth')}
          </Button>
        </div>

        <fieldset disabled={isSaving} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 数据看板 */}
          {activeTab === 'dashboard' && (
            <div id="admin-settings-scroll" className="min-h-0 flex-1 overflow-y-auto">
              <DashboardTab />
            </div>
          )}

          {/* 站点配置 */}
          {activeTab === 'site' && (
            <SiteConfigTab
              siteConfig={drafts.site.value}
              setSiteConfig={drafts.site.setValue}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onMutate={mutate}
              onSaved={(config) => drafts.site.markSaved(config)}
              hasUnsavedChanges={drafts.site.isDirty}
              isSuperAdmin={profile.role === 'super_admin'}
            />
          )}

          {/* 存储配置 */}
          {activeTab === 'storage' && (
            <StorageConfigTab
              storageConfig={drafts.storage.value}
              setStorageConfig={drafts.storage.setValue}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              isTesting={isTesting}
              setIsTesting={setIsTesting}
              onMutate={mutate}
              onSaved={(config) => drafts.storage.markSaved(config)}
              hasUnsavedChanges={drafts.storage.isDirty}
            />
          )}

          {/* UI 配置 */}
          {activeTab === 'ui' && (
            <UIConfigTab
              uiConfig={drafts.ui.value}
              securityConfig={securityConfig}
              onMutate={mutate}
              onDirtyChange={setAutosaveDirty}
              onSavingChange={setAutosaveSaving}
              onSaved={(update) => {
                void mutate(
                  (current) => ({
                    ...current,
                    ...(update.ui ? { ui: update.ui } : {}),
                    ...(update.requireCertifiedUserForExplore !== undefined
                      ? {
                          security: {
                            ...current?.security,
                            requireCertifiedUserForExplore: update.requireCertifiedUserForExplore,
                          },
                        }
                      : {}),
                  }),
                  { revalidate: false }
                );
              }}
            />
          )}

          {/* OAuth 配置 */}
          {activeTab === 'oauth' && (
            <OAuthConfigTab
              securityConfig={securityConfig}
              setSecurityConfig={drafts.security.setValue}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onMutate={mutate}
              onSaved={(oauth) =>
                drafts.security.markSaved(securityConfig, { ...securityConfig, oauth })
              }
              hasUnsavedChanges={drafts.security.isDirty}
            />
          )}

          {/* AI 配置 */}
          {activeTab === 'ai' && (
            <AIConfigTab
              aiConfig={drafts.ai.value}
              setAiConfig={drafts.ai.setValue}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              onMutate={mutate}
              onSaved={(config) => drafts.ai.markSaved(drafts.ai.value, config)}
              hasUnsavedChanges={drafts.ai.isDirty}
            />
          )}

          {/* Hook 配置 */}
          {activeTab === 'hooks' && (
            <div id="admin-settings-scroll" className="min-h-0 flex-1 overflow-y-auto">
              <HooksConfigTab
                notificationConfig={configs?.notification}
                setNotificationConfig={(notification) => {
                  void mutate((current) => ({ ...current, notification }), { revalidate: false });
                }}
                isSaving={isSaving}
                setIsSaving={setIsSaving}
                onMutate={mutate}
                onDirtyChange={setHooksDirty}
              />
            </div>
          )}

          {/* 用户管理 */}
          {activeTab === 'users' && (
            <div id="admin-settings-scroll" className="min-h-0 flex-1 overflow-y-auto">
              <UsersTab
                onDirtyChange={setUserPermissionsDirty}
                onSavingChange={setUserPermissionsSaving}
              />
            </div>
          )}

          {/* 权限管理 */}
          {activeTab === 'permissions' && <PermissionsTab onSavingChange={setPermissionsSaving} />}
        </fieldset>
      </div>
      <UnsavedSettingsDialog {...navigation.dialogProps} />
    </ContainerWithSideBar>
  );
}
