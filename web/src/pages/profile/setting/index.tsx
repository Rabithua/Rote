import { AppleIcon } from '@/components/icons/Apple';
import NavBar from '@/components/layout/navBar';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import {
  loadProfileAtom,
  loadUserSettingsAtom,
  profileAtom,
  userSettingsAtom,
} from '@/state/profile';
import { del, put } from '@/utils/api';
import { authService } from '@/utils/auth';
import i18n from 'i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { Github, Loader, Settings2, Stars } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import DeleteAccountDialog from '../components/DeleteAccountDialog';
import MergeAccountDialog from '../components/MergeAccountDialog';
import ProfileSidebar from '../components/ProfileSidebar';
import { useOAuthBinding } from '../hooks/useOAuthBinding';

export default function SettingsPage() {
  const { data: siteStatus } = useSiteStatus();
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const { theme, setTheme } = useTheme();

  const profile = useAtomValue(profileAtom);
  const userSettings = useAtomValue(userSettingsAtom);
  const loadProfile = useSetAtom(loadProfileAtom);
  const loadUserSettings = useSetAtom(loadUserSettingsAtom);

  const [allowExplore, setAllowExplore] = useState<boolean>(true);
  const [lang, setLang] = useState(i18n.language);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const {
    bindingProviders,
    unbindingProviders,
    isMergeDialogOpen,
    setIsMergeDialogOpen,
    isMerging,
    mergeInfo,
    handleBindOAuth,
    handleUnbindOAuth,
    handleConfirmMerge,
    handleCancelMerge,
    handleOAuthCallback,
  } = useOAuthBinding(loadProfile);

  useEffect(() => {
    if (!profile) {
      loadProfile();
    }
    loadUserSettings();
  }, [profile, loadProfile, loadUserSettings]);

  useEffect(() => {
    setAllowExplore(userSettings?.allowExplore ?? true);
  }, [userSettings]);

  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

  const saveSettings = async () => {
    try {
      setSettingsSaving(true);
      await put('/users/me/settings', {
        allowExplore,
      });
      toast.success(t('settings.saveSuccess'));
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(t('settings.saveFailed', { error: errorMessage }));
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error(t('settings.deleteAccount.passwordRequired'));
      return;
    }

    try {
      setIsDeletingAccount(true);
      await del('/users/me', {
        data: { password: deletePassword },
      });
      toast.success(t('settings.deleteAccount.success'));
      setTimeout(() => {
        authService.logout(true);
      }, 1000);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(t('settings.deleteAccount.failed', { error: errorMessage }));
    } finally {
      setIsDeletingAccount(false);
      setDeletePassword('');
    }
  };

  const getOAuthProviderInfo = (provider: string) => {
    const providerInfo: Record<string, { icon: any; labelKey: string }> = {
      github: {
        icon: Github,
        labelKey: 'settings.oauth.github.title',
      },
      apple: {
        icon: AppleIcon,
        labelKey: 'settings.oauth.apple.title',
      },
    };
    return (
      providerInfo[provider] || {
        icon: null,
        labelKey: `settings.oauth.${provider}.title`,
      }
    );
  };

  const enabledOAuthProviders = siteStatus?.oauth?.providers || {};

  return (
    <ContainerWithSideBar
      sidebar={<ProfileSidebar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Stars className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <div className="flex flex-col pb-20">
        <NavBar title={t('settings.title')} icon={<Settings2 className="size-7" />} />

        <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
          <div className="space-y-6">
            {/* 允许探索设置 */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-base font-semibold">{t('settings.allowExploreLabel')}</div>
                <p className="text-muted-foreground text-sm">
                  {t('settings.allowExploreDescription')}
                </p>
              </div>
              <Switch checked={allowExplore} onCheckedChange={setAllowExplore} />
            </div>

            {/* 颜色模式设置 */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-base font-semibold">{t('settings.themeLabel')}</div>
                <p className="text-muted-foreground text-sm">{t('settings.themeDescription')}</p>
              </div>
              <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
                <SelectTrigger className="min-w-30" aria-label={t('settings.themeLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t('settings.themeSystem')}</SelectItem>
                  <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
                  <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 语言设置 */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-base font-semibold">{t('settings.languageLabel')}</div>
                <p className="text-muted-foreground text-sm">{t('settings.languageDescription')}</p>
              </div>
              <Select
                value={lang}
                onValueChange={(v) => {
                  setLang(v);
                  i18n.changeLanguage(v);
                }}
              >
                <SelectTrigger className="min-w-30" aria-label={t('settings.languageLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">简体中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="mt-2 w-full"
              onClick={() => {
                if (!settingsSaving) {
                  saveSettings();
                }
              }}
            >
              {settingsSaving && <Loader className="mr-2 size-4 animate-spin" />}
              {settingsSaving ? t('settings.saving') : t('settings.save')}
            </Button>
          </div>

          {/* OAuth 账户关联 */}
          {Object.keys(enabledOAuthProviders).length > 0 && (
            <div className="border-t pt-8">
              <div className="space-y-6">
                <div>
                  <div className="text-base font-semibold">{t('settings.oauth.title')}</div>
                  <p className="text-muted-foreground text-sm">{t('settings.oauth.description')}</p>
                </div>
                <div className="grid gap-4">
                  {Object.entries(enabledOAuthProviders).map(([provider, config]) => {
                    if (!config?.enabled) return null;
                    const providerInfo = getOAuthProviderInfo(provider);
                    const IconComponent = providerInfo.icon;
                    const binding = profile?.oauthBindings?.find((b) => b.provider === provider);
                    const isBound = !!binding;
                    const isBinding = bindingProviders[provider] || false;
                    const isUnbinding = unbindingProviders[provider] || false;

                    return (
                      <div
                        key={provider}
                        className="flex items-center justify-between gap-4 rounded-lg border p-4"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {IconComponent && <IconComponent className="size-5 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-semibold">
                              {t(providerInfo.labelKey, {
                                defaultValue: provider.charAt(0).toUpperCase() + provider.slice(1),
                              })}
                            </div>
                            <div className="text-muted-foreground min-w-0 text-sm">
                              {isBound && binding ? (
                                <div className="min-w-0 break-all">
                                  {binding.providerUsername
                                    ? provider === 'github'
                                      ? `@${binding.providerUsername}`
                                      : binding.providerUsername
                                    : `ID: ${binding.providerId}`}
                                </div>
                              ) : (
                                t(`settings.oauth.${provider}.notBound`, {
                                  defaultValue: t('settings.oauth.notBound'),
                                })
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isBound ? (
                            <Button
                              variant="outline"
                              onClick={() => handleUnbindOAuth(provider)}
                              disabled={isUnbinding}
                            >
                              {isUnbinding && <Loader className="mr-2 size-4 animate-spin" />}
                              {isUnbinding
                                ? t(`settings.oauth.${provider}.unbinding`, {
                                    defaultValue: t('settings.oauth.unbinding'),
                                  })
                                : t(`settings.oauth.${provider}.unbind`, {
                                    defaultValue: t('settings.oauth.unbind'),
                                  })}
                            </Button>
                          ) : (
                            <Button onClick={() => handleBindOAuth(provider)} disabled={isBinding}>
                              {isBinding && <Loader className="mr-2 size-4 animate-spin" />}
                              {isBinding
                                ? t(`settings.oauth.${provider}.binding`, {
                                    defaultValue: t('settings.oauth.binding'),
                                  })
                                : t(`settings.oauth.${provider}.bind`, {
                                    defaultValue: t('settings.oauth.bind'),
                                  })}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 危险操作 */}
          <div className="border-t pt-8">
            <div className="space-y-4">
              <div>
                <div className="text-destructive text-base font-semibold">
                  {t('settings.deleteAccount.title')}
                </div>
                <p className="text-muted-foreground text-sm">
                  {t('settings.deleteAccount.description')}
                </p>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setIsDeleteAccountModalOpen(true)}
              >
                {t('settings.deleteAccount.button')}
              </Button>
            </div>
          </div>
        </div>

        <MergeAccountDialog
          isOpen={isMergeDialogOpen}
          onOpenChange={setIsMergeDialogOpen}
          mergeInfo={mergeInfo}
          profile={profile}
          onConfirm={handleConfirmMerge}
          onCancel={handleCancelMerge}
          isMerging={isMerging}
        />

        <DeleteAccountDialog
          isOpen={isDeleteAccountModalOpen}
          onOpenChange={setIsDeleteAccountModalOpen}
          password={deletePassword}
          onPasswordChange={setDeletePassword}
          onConfirm={handleDeleteAccount}
          onCancel={() => {
            setIsDeleteAccountModalOpen(false);
            setDeletePassword('');
          }}
          isDeleting={isDeletingAccount}
        />
      </div>
    </ContainerWithSideBar>
  );
}
