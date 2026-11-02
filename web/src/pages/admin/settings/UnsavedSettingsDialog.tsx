import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';

interface UnsavedSettingsDialogProps {
  open: boolean;
  isSaving: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}

export default function UnsavedSettingsDialog({
  open,
  isSaving,
  onContinue,
  onDiscard,
}: UnsavedSettingsDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.unsavedChanges' });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onContinue()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-background flex-row border-t pt-4">
          <Button
            variant="outline"
            onClick={onContinue}
            className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal"
          >
            {t('continueEditing')}
          </Button>
          <Button
            variant="destructive"
            disabled={isSaving}
            onClick={onDiscard}
            className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal"
          >
            {t('discardAndLeave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
