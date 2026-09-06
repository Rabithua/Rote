import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { post } from '@/utils/api';

export default function EmbeddingRebuildButton({
  disabled,
  revision,
  runAction,
}: {
  disabled: boolean;
  revision: number;
  runAction: (key: string, action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.ai' });
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>{t('rebuild')}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('rebuildCancel')}>
        <DialogHeader>
          <DialogTitle>{t('rebuild')}</DialogTitle>
          <DialogDescription>{t('rebuildConfirmation')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            {t('rebuildCancel')}
          </Button>
          <Button
            className="flex-[2]"
            disabled={disabled}
            onClick={() =>
              runAction(
                'rebuild',
                async () => {
                  const result = await post('/ai/index/rebuild', { revision });
                  setOpen(false);
                  return result;
                },
                t('rebuildStarted')
              )
            }
          >
            {t('rebuildConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
