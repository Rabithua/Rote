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
  isBindingGitHub: boolean;
  isUnbindingGitHub: boolean;
  onBindGitHub: () => void;
  onUnbindGitHub: () => void;
  onDeleteAccount: () => void;
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
  onDeleteAccount,
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

          {/* OAuth 账户关联 */}
          <div className="border-t pt-4">
            <div className="space-y-4">
              <div>
                <div className="text-base font-semibold">{t('settings.oauth.title')}</div>
                <p className="text-muted-foreground text-sm">{t('settings.oauth.description')}</p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Github className="size-5 shadow-red-50" />
                  <div className="shrink-0">
                    <div className="text-base font-semibold">
                      {t('settings.oauth.github.title')}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {profile?.authProviderId ? (
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
                {profile?.authProviderId ? (
                  <Button variant="outline" onClick={onUnbindGitHub} disabled={isUnbindingGitHub}>
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
            </div>
          </div>

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
