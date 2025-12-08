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
    provider: 'github' | 'apple';
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
            {mergeInfo?.provider === 'apple'
              ? t('settings.oauth.apple.mergeDialog.title')
              : t('settings.oauth.github.mergeDialog.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {mergeInfo?.provider === 'apple'
              ? t('settings.oauth.apple.mergeDialog.description')
              : t('settings.oauth.github.mergeDialog.description')}
          </p>
          {mergeInfo && (
            <div className="bg-muted space-y-2 rounded-lg p-4">
              <div className="text-sm">
                <span className="font-semibold">
                  {mergeInfo.provider === 'apple'
                    ? t('settings.oauth.apple.mergeDialog.existingAccount')
                    : t('settings.oauth.github.mergeDialog.existingAccount')}
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
                  {mergeInfo.provider === 'apple'
                    ? t('settings.oauth.apple.mergeDialog.currentAccount')
                    : t('settings.oauth.github.mergeDialog.currentAccount')}
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
            {mergeInfo?.provider === 'apple'
              ? t('settings.oauth.apple.mergeDialog.warning')
              : t('settings.oauth.github.mergeDialog.warning')}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isMerging}>
              {mergeInfo?.provider === 'apple'
                ? t('settings.oauth.apple.mergeDialog.cancel')
                : t('settings.oauth.github.mergeDialog.cancel')}
            </Button>
            <Button className="flex-1" onClick={onConfirm} disabled={isMerging}>
              {isMerging && <Loader className="mr-2 size-4 animate-spin" />}
              {isMerging
                ? mergeInfo?.provider === 'apple'
                  ? t('settings.oauth.apple.mergeDialog.merging')
                  : t('settings.oauth.github.mergeDialog.merging')
                : mergeInfo?.provider === 'apple'
                  ? t('settings.oauth.apple.mergeDialog.confirm')
                  : t('settings.oauth.github.mergeDialog.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
