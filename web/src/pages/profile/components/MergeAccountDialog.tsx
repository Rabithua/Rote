import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Profile } from '@/types/main';
import { Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MergeAccountDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mergeInfo: {
    existingUserId: string;
    existingUsername: string;
    existingEmail: string;
    provider: string;
    providerUserId: string;
    providerUsername: string;
  } | null;
  profile: Profile | undefined;
  onConfirm: () => void;
  onCancel: () => void;
  isMerging: boolean;
}

export default function MergeAccountDialog({
  isOpen,
  onOpenChange,
  mergeInfo,
  profile,
  onConfirm,
  onCancel,
  isMerging,
}: MergeAccountDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>
            {t(`settings.oauth.${mergeInfo?.provider || 'github'}.mergeDialog.title`, {
              defaultValue: t('settings.oauth.mergeDialog.title'),
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {t(`settings.oauth.${mergeInfo?.provider || 'github'}.mergeDialog.description`, {
              defaultValue: t('settings.oauth.mergeDialog.description'),
            })}
          </p>
          {mergeInfo && (
            <div className="bg-muted space-y-2 rounded-lg p-4">
              <div className="text-sm">
                <span className="font-semibold">
                  {t(`settings.oauth.${mergeInfo.provider}.mergeDialog.existingAccount`, {
                    defaultValue: t('settings.oauth.mergeDialog.existingAccount'),
                  })}
                  :
                </span>
                <div className="mt-1">
                  <div>@{mergeInfo.existingUsername}</div>
                  {mergeInfo.existingEmail && (
                    <div className="text-muted-foreground text-xs">{mergeInfo.existingEmail}</div>
                  )}
                </div>
              </div>
              <div className="text-sm">
                <span className="font-semibold">
                  {t(`settings.oauth.${mergeInfo.provider}.mergeDialog.currentAccount`, {
                    defaultValue: t('settings.oauth.mergeDialog.currentAccount'),
                  })}
                  :
                </span>
                <div className="mt-1">
                  <div>@{profile?.username}</div>
                  {profile?.email && (
                    <div className="text-muted-foreground text-xs">{profile.email}</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="text-destructive text-sm">
            {t(`settings.oauth.${mergeInfo?.provider || 'github'}.mergeDialog.warning`, {
              defaultValue: t('settings.oauth.mergeDialog.warning'),
            })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isMerging}>
              {t(`settings.oauth.${mergeInfo?.provider || 'github'}.mergeDialog.cancel`, {
                defaultValue: t('settings.oauth.mergeDialog.cancel'),
              })}
            </Button>
            <Button className="flex-1" onClick={onConfirm} disabled={isMerging}>
              {isMerging && <Loader className="mr-2 size-4 animate-spin" />}
              {isMerging
                ? t(`settings.oauth.${mergeInfo?.provider || 'github'}.mergeDialog.merging`, {
                    defaultValue: t('settings.oauth.mergeDialog.merging'),
                  })
                : t(`settings.oauth.${mergeInfo?.provider || 'github'}.mergeDialog.confirm`, {
                    defaultValue: t('settings.oauth.mergeDialog.confirm'),
                  })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
