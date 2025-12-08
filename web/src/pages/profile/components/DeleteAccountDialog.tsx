import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export default function DeleteAccountDialog({
  isOpen,
  onOpenChange,
  password,
  onPasswordChange,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.deleteAccount.confirmTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">{t('settings.deleteAccount.warning')}</p>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {t('settings.deleteAccount.passwordLabel')}
            </label>
            <Input
              type="password"
              placeholder={t('settings.deleteAccount.passwordPlaceholder')}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              disabled={isDeleting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isDeleting && password) {
                  onConfirm();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isDeleting}>
              {t('settings.deleteAccount.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={onConfirm}
              disabled={isDeleting || !password}
            >
              {isDeleting && <Loader className="mr-2 size-4 animate-spin" />}
              {isDeleting
                ? t('settings.deleteAccount.deleting')
                : t('settings.deleteAccount.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
