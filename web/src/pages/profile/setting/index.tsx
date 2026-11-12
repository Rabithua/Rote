import { AppleIcon } from '@/components/icons/Apple';
import NavBar from '@/components/layout/navBar';
import ResourceStatusSection from '@/features/resources/ResourceStatusSection';
import {
  parseResourcePreviewScenario,
  RESOURCE_PREVIEW_SCENARIOS,
  RESOURCE_PREVIEW_STATES,
} from '@/features/resources/preview';
import { isOfficialApiOrigin, useResourceState } from '@/features/resources/useResourceState';
import { Button } from '@/components/ui/button';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { loadProfileAtom, profileAtom } from '@/state/profile';
import { del, get } from '@/utils/api';
import { authService } from '@/utils/auth';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Fingerprint,
  Github,
  Loader,
  Settings2,
  Stars,
  Trash2,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Key,
  ShieldX,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link, useSearchParams } from 'react-router-dom';
import DeleteAccountDialog, { type DeleteConfirmMethod } from '../components/DeleteAccountDialog';
import MergeAccountDialog from '../components/MergeAccountDialog';
import ProfilePreferencesSection from '../components/ProfilePreferencesSection';
import ProfileSidebar from '../components/ProfileSidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOAuthBinding } from '../hooks/useOAuthBinding';
import { usePasskey } from '@/hooks/usePasskey';
import { confirmDeletionWithPasskey, fetchMockDeleteGrant } from '@/utils/passkey';
import {
  ChangePasswordDialog,
  ClearPasswordDialog,
  SetPasswordDialog,
} from '../components/PasswordDialogs';

export default function SettingsPage() {
  const { data: siteStatus } = useSiteStatus();
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const { t: tPreview } = useTranslation('translation', {
    keyPrefix: 'pages.officialResourcesPreview',
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const profile = useAtomValue(profileAtom);
  const previewScenario = import.meta.env.DEV
    ? parseResourcePreviewScenario(searchParams.get('officialResourcesPreview'))
    : null;
  const showOfficialResources = isOfficialApiOrigin() || previewScenario !== null;
  const {
    data: resourceState,
    error: resourceError,
    isLoading: resourceLoading,
    mutate: mutateResourceState,
  } = useResourceState(Boolean(profile) && showOfficialResources && previewScenario === null);
  const loadProfile = useSetAtom(loadProfileAtom);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletingMethod, setDeletingMethod] = useState<DeleteConfirmMethod | null>(null);

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isClearPasswordOpen, setIsClearPasswordOpen] = useState(false);
  const [isSetPasswordOpen, setIsSetPasswordOpen] = useState(false);

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

  const {
    isRegistering,
    passkeys,
    isLoading: isLoadingPasskeys,
    registerPasskey,
    fetchPasskeys,
    deletePasskey,
  } = usePasskey();

  useEffect(() => {
    if (!profile) {
      loadProfile();
    }
  }, [profile, loadProfile]);

  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

  useEffect(() => {
    if (profile && siteStatus?.passkey?.enabled !== false) {
      fetchPasskeys();
    }
  }, [profile, siteStatus, fetchPasskeys]);

  const canClearPassword = (profile?.oauthBindings?.length ?? 0) > 0 || passkeys.length > 0;

  const reportDeletionError = (error: any) => {
    const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
    toast.error(t('settings.deleteAccount.failed', { error: errorMessage }));
  };

  const performAccountDeletion = async (
    body: Record<string, unknown>,
    method: 'password' | 'oauth' | 'passkey' | 'mock'
  ) => {
    try {
      setIsDeletingAccount(true);
      setDeletingMethod(method);
      await del('/users/me', { data: body });
      toast.success(t('settings.deleteAccount.success'));
      setIsDeleteAccountModalOpen(false);
      setTimeout(() => {
        authService.logout(true);
      }, 1000);
    } catch (error: any) {
      reportDeletionError(error);
    } finally {
      setIsDeletingAccount(false);
      setDeletingMethod(null);
    }
  };

  const handleConfirmPassword = (password: string) => {
    if (!password) {
      toast.error(t('settings.deleteAccount.passwordRequired'));
      return;
    }
    performAccountDeletion({ password }, 'password');
  };

  const handleConfirmOAuthDeletion = async (provider: string) => {
    try {
      const response = await get(
        `/auth/oauth/${provider}/delete-confirm?redirect=${encodeURIComponent('/profile/setting')}`
      );
      if (response.data?.redirectUrl) {
        window.location.href = response.data.redirectUrl;
        return;
      }
      throw new Error(t('settings.deleteAccount.oauthInitFailed', { provider }));
    } catch (error: any) {
      reportDeletionError(error);
    }
  };

  const handleConfirmPasskeyDeletion = async () => {
    try {
      const deleteGrant = await confirmDeletionWithPasskey();
      await performAccountDeletion({ deleteGrant }, 'passkey');
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        toast.info(t('settings.deleteAccount.passkeyCancelled'));
        return;
      }
      reportDeletionError(error);
    }
  };

  const handleConfirmMockDeletion = async () => {
    try {
      const deleteGrant = await fetchMockDeleteGrant();
      await performAccountDeletion({ deleteGrant }, 'mock');
    } catch (error: any) {
      reportDeletionError(error);
    }
  };

  // OAuth / Passkey 再验证完成后携带 deleteGrant 回到本页，直接完成删除
  const deleteGrantFromCallback = searchParams.get('deleteGrant');
  const oauthCallbackStatus = searchParams.get('oauth');
  useEffect(() => {
    if (oauthCallbackStatus === 'delete-confirmed' && deleteGrantFromCallback) {
      performAccountDeletion({ deleteGrant: deleteGrantFromCallback }, 'oauth');
      const next = new URLSearchParams(searchParams);
      next.delete('oauth');
      next.delete('deleteGrant');
      next.delete('provider');
      setSearchParams(next, { replace: true });
    } else if (oauthCallbackStatus === 'delete-error') {
      const errorMessage = searchParams.get('message') || 'Unknown error';
      toast.error(t('settings.deleteAccount.failed', { error: errorMessage }));
      const next = new URLSearchParams(searchParams);
      next.delete('oauth');
      next.delete('provider');
      next.delete('message');
      setSearchParams(next, { replace: true });
    }
  }, [oauthCallbackStatus, deleteGrantFromCallback]);

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
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <Stars className="size-5" />
          {t('sideBarTitle')}
        </div>
      }
      className="divide-y"
    >
      <NavBar title={t('settings.title')} icon={<Settings2 className="size-5" />}>
        {(isLoadingPasskeys || isRegistering) && (
          <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
        )}
      </NavBar>

      {showOfficialResources ? (
        <div>
          {previewScenario ? (
            <div className="flex flex-wrap gap-2 border-b p-4">
              {RESOURCE_PREVIEW_SCENARIOS.map((scenario) => (
                <Button
                  key={scenario}
                  type="button"
                  size="sm"
                  variant={previewScenario === scenario ? 'default' : 'outline'}
                  aria-pressed={previewScenario === scenario}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('officialResourcesPreview', scenario);
                    setSearchParams(next, { replace: true });
                  }}
                >
                  {tPreview(`scenarios.${scenario}.title`)}
                </Button>
              ))}
            </div>
          ) : null}
          <ResourceStatusSection
            state={previewScenario ? RESOURCE_PREVIEW_STATES[previewScenario] : resourceState}
            isLoading={previewScenario ? false : resourceLoading}
            error={previewScenario ? undefined : resourceError}
            onRetry={() => void mutateResourceState()}
            trustedOfficialPreview={previewScenario !== null}
          />
        </div>
      ) : null}

      <ProfilePreferencesSection />

      <div className="space-y-4 p-4">
        <div>
          <div className="text-base font-semibold">{t('settings.blockedUsers.title')}</div>
          <p className="text-muted-foreground text-sm">{t('settings.blockedUsers.description')}</p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/profile/blocked">
            <ShieldX className="size-4" />
            {t('settings.blockedUsers.open')}
          </Link>
        </Button>
      </div>

      {/* OAuth 账户关联 */}
      {Object.keys(enabledOAuthProviders).length > 0 && (
        <div className="space-y-4 p-4">
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
      )}

      {/* Passkey 管理 */}
      {siteStatus?.passkey?.enabled !== false && (
        <div className="space-y-4 p-4">
          <div>
            <div className="text-base font-semibold">{t('settings.passkey.title')}</div>
            <p className="text-muted-foreground text-sm">{t('settings.passkey.description')}</p>
          </div>

          {/* Passkey list */}
          {passkeys.length > 0 ? (
            <div className="grid gap-3">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Fingerprint className="size-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{pk.deviceName || 'Unknown'}</div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(pk.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
                    onClick={() => {
                      if (confirm(t('settings.passkey.confirmDelete'))) {
                        deletePasskey(pk.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : !isLoadingPasskeys ? (
            <div className="text-muted-foreground text-sm">{t('settings.passkey.noPasskeys')}</div>
          ) : null}

          <Button
            onClick={() => registerPasskey()}
            disabled={isRegistering}
            variant="outline"
            className="w-full"
          >
            {isRegistering && <Loader className="mr-2 size-4 animate-spin" />}
            <Fingerprint className="mr-2 size-4" />
            {isRegistering ? t('settings.passkey.adding') : t('settings.passkey.add')}
          </Button>
        </div>
      )}

      {/* 密码安全 */}
      <div className="space-y-4 p-4">
        <div>
          <div className="text-base font-semibold">{t('settings.password.title')}</div>
          <p className="text-muted-foreground text-sm">{t('settings.password.description')}</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <KeyRound className="size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold">{t('settings.password.status')}</div>
              <div className="text-muted-foreground text-sm">
                {profile?.hasPassword
                  ? t('settings.password.hasPassword')
                  : t('settings.password.noPassword')}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-1">
            {profile?.hasPassword ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setIsChangePasswordOpen(true)}
                  title={t('settings.password.change')}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-8"
                        onClick={() => setIsClearPasswordOpen(true)}
                        disabled={!canClearPassword}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={4}>
                    {canClearPassword
                      ? t('settings.password.clear')
                      : t('settings.password.clearWarning')}
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setIsSetPasswordOpen(true)}
                title={t('settings.password.set')}
              >
                <Key className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 危险操作 */}
      <div className="border-t p-4">
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
        hasPassword={profile?.hasPassword !== false}
        oauthProviders={(profile?.oauthBindings || []).map((binding) => binding.provider)}
        hasPasskey={passkeys.length > 0}
        showMockOption={import.meta.env.DEV && profile?.hasPassword === false}
        isDeleting={isDeletingAccount}
        deletingMethod={deletingMethod}
        onConfirmPassword={handleConfirmPassword}
        onConfirmOAuth={handleConfirmOAuthDeletion}
        onConfirmPasskey={handleConfirmPasskeyDeletion}
        onConfirmMock={handleConfirmMockDeletion}
      />

      <ChangePasswordDialog
        isOpen={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
        onSuccess={loadProfile}
      />

      <ClearPasswordDialog
        isOpen={isClearPasswordOpen}
        onOpenChange={setIsClearPasswordOpen}
        onSuccess={loadProfile}
      />

      <SetPasswordDialog
        isOpen={isSetPasswordOpen}
        onOpenChange={setIsSetPasswordOpen}
        onSuccess={loadProfile}
      />
    </ContainerWithSideBar>
  );
}
