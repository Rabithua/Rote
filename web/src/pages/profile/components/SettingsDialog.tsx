import { AppleIcon } from '@/components/icons/Apple';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { Profile } from '@/types/main';
import { Github, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allowExplore: boolean;
  onAllowExploreChange: (checked: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  profile: Profile | undefined;
  onDeleteAccount: () => void;
  enabledOAuthProviders?: Record<string, { enabled?: boolean }>;
  bindingProviders?: Record<string, boolean>;
  unbindingProviders?: Record<string, boolean>;
  onBindOAuth: (provider: string) => void;
  onUnbindOAuth: (provider: string) => void;
}

export default function SettingsDialog({
  isOpen,
  onOpenChange,
  allowExplore,
  onAllowExploreChange,
  onSave,
  isSaving,
  profile,
  onDeleteAccount,
  enabledOAuthProviders = {},
  bindingProviders = {},
  unbindingProviders = {},
  onBindOAuth,
  onUnbindOAuth,
}: SettingsDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

  // 获取 OAuth 提供商的显示信息
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-base font-semibold">{t('settings.allowExploreLabel')}</div>
              <p className="text-muted-foreground text-sm">
                {t('settings.allowExploreDescription')}
              </p>
            </div>
            <Switch checked={allowExplore} onCheckedChange={onAllowExploreChange} />
          </div>

          <Button
            className="mt-2 w-full"
            onClick={() => {
              if (!isSaving) {
                onSave();
              }
            }}
          >
            {isSaving && <Loader className="mr-2 size-4 animate-spin" />}
            {isSaving ? t('settings.saving') : t('settings.save')}
          </Button>

          {/* OAuth 账户关联 - 仅在系统启用 OAuth 时显示 */}
          {Object.keys(enabledOAuthProviders).length > 0 && (
            <div className="border-t pt-4">
              <div className="space-y-4">
                <div>
                  <div className="text-base font-semibold">{t('settings.oauth.title')}</div>
                  <p className="text-muted-foreground text-sm">{t('settings.oauth.description')}</p>
                </div>
                {Object.entries(enabledOAuthProviders).map(([provider, config]) => {
                  if (!config?.enabled) return null;
                  const providerInfo = getOAuthProviderInfo(provider);
                  const IconComponent = providerInfo.icon;
                  // 检查是否已绑定该提供商
                  const isBound =
                    profile?.oauthBindings?.some((binding) => binding.provider === provider) ||
                    false;
                  // 从 oauthBindings 数组中查找对应的绑定信息
                  const binding = profile?.oauthBindings?.find((b) => b.provider === provider);
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
                            onClick={() => onUnbindOAuth(provider)}
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
                          <Button onClick={() => onBindOAuth(provider)} disabled={isBinding}>
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

          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="text-destructive text-base font-semibold">
                {t('settings.deleteAccount.title')}
              </div>
              <p className="text-muted-foreground text-sm">
                {t('settings.deleteAccount.description')}
              </p>
              <Button variant="destructive" className="mt-2 w-full" onClick={onDeleteAccount}>
                {t('settings.deleteAccount.button')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
