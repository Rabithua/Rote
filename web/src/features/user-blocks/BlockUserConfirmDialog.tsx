import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader } from 'lucide-react';

interface BlockUserConfirmDialogProps {
  isMutating: boolean;
  open: boolean;
  targetDisplayName: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export default function BlockUserConfirmDialog({
  isMutating,
  open,
  targetDisplayName,
  onConfirm,
  onOpenChange,
}: BlockUserConfirmDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'userBlocks' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('cancel')}>
        <DialogHeader>
          <DialogTitle>{t('confirmTitle', { user: targetDisplayName })}</DialogTitle>
          <DialogDescription>{t('confirmDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isMutating}>
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button variant="destructive" disabled={isMutating} onClick={() => void onConfirm()}>
            {isMutating && <Loader className="size-4 animate-spin" />}
            {isMutating ? t('blocking') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
