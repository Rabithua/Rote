import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { Profile } from '@/types/main';
import { Apple, Github, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allowExplore: boolean;
  onAllowExploreChange: (checked: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  profile: Profile | undefined;
  isBindingGitHub: boolean;
  isUnbindingGitHub: boolean;
  onBindGitHub: () => void;
  onUnbindGitHub: () => void;
  isBindingApple: boolean;
  isUnbindingApple: boolean;
  onBindApple: () => void;
  onUnbindApple: () => void;
  onDeleteAccount: () => void;
  isGitHubOAuthEnabled?: boolean;
  isAppleOAuthEnabled?: boolean;
}

export default function SettingsDialog({
  isOpen,
  onOpenChange,
  allowExplore,
  onAllowExploreChange,
  onSave,
  isSaving,
  profile,
  isBindingGitHub,
  isUnbindingGitHub,
  onBindGitHub,
  onUnbindGitHub,
  isBindingApple,
  isUnbindingApple,
  onBindApple,
  onUnbindApple,
  onDeleteAccount,
  isGitHubOAuthEnabled = false,
  isAppleOAuthEnabled = false,
}: SettingsDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

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
          {(isGitHubOAuthEnabled || isAppleOAuthEnabled) && (
            <div className="border-t pt-4">
              <div className="space-y-4">
                <div>
                  <div className="text-base font-semibold">{t('settings.oauth.title')}</div>
                  <p className="text-muted-foreground text-sm">{t('settings.oauth.description')}</p>
                </div>
                {isGitHubOAuthEnabled && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Github className="size-5 shadow-red-50" />
                      <div className="shrink-0">
                        <div className="text-base font-semibold">
                          {t('settings.oauth.github.title')}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {profile?.boundOAuthProvider === 'github' ? (
                            <div className="flex items-center gap-2">
                              {profile.authProviderUsername
                                ? `@${profile.authProviderUsername}`
                                : `ID: ${profile.authProviderId}`}
                            </div>
                          ) : (
                            t('settings.oauth.github.notBound')
                          )}
                        </div>
                      </div>
                    </div>
                    {profile?.boundOAuthProvider === 'github' ? (
                      <Button
                        variant="outline"
                        onClick={onUnbindGitHub}
                        disabled={isUnbindingGitHub}
                      >
                        {isUnbindingGitHub && <Loader className="mr-2 size-4 animate-spin" />}
                        {isUnbindingGitHub
                          ? t('settings.oauth.github.unbinding')
                          : t('settings.oauth.github.unbind')}
                      </Button>
                    ) : (
                      <Button onClick={onBindGitHub} disabled={isBindingGitHub}>
                        {isBindingGitHub && <Loader className="mr-2 size-4 animate-spin" />}
                        {isBindingGitHub
                          ? t('settings.oauth.github.binding')
                          : t('settings.oauth.github.bind')}
                      </Button>
                    )}
                  </div>
                )}
                {isAppleOAuthEnabled && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Apple className="size-5" />
                      <div className="shrink-0">
                        <div className="text-base font-semibold">
                          {t('settings.oauth.apple.title')}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {profile?.boundOAuthProvider === 'apple' ? (
                            <div className="flex items-center gap-2">
                              {profile.authProviderUsername
                                ? profile.authProviderUsername
                                : `ID: ${profile.authProviderId}`}
                            </div>
                          ) : (
                            t('settings.oauth.apple.notBound')
                          )}
                        </div>
                      </div>
                    </div>
                    {profile?.boundOAuthProvider === 'apple' ? (
                      <Button variant="outline" onClick={onUnbindApple} disabled={isUnbindingApple}>
                        {isUnbindingApple && <Loader className="mr-2 size-4 animate-spin" />}
                        {isUnbindingApple
                          ? t('settings.oauth.apple.unbinding')
                          : t('settings.oauth.apple.unbind')}
                      </Button>
                    ) : (
                      <Button onClick={onBindApple} disabled={isBindingApple}>
                        {isBindingApple && <Loader className="mr-2 size-4 animate-spin" />}
                        {isBindingApple
                          ? t('settings.oauth.apple.binding')
                          : t('settings.oauth.apple.bind')}
                      </Button>
                    )}
                  </div>
                )}
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
