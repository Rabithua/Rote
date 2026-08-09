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

interface ImportCancelDialogProps {
  open: boolean;
  onContinue: () => void;
  onStop: () => void;
}

export function ImportCancelDialog({ open, onContinue, onStop }: ImportCancelDialogProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData.importTask',
  });

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('leaveTitle')}</DialogTitle>
          <DialogDescription>{t('leaveDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onContinue}>
            {t('continue')}
          </Button>
          <Button variant="destructive" onClick={onStop}>
            {t('stop')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
