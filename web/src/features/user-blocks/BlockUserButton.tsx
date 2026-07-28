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
import { blockUser, unblockUser } from './api';
import { refreshBlockAffectedCaches } from './cache';
import { Loader, UserRoundX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface BlockUserButtonProps {
  blocked: boolean;
  targetDisplayName: string;
  targetUserId: string;
  onChanged?: (blocked: boolean) => void | Promise<void>;
}

export default function BlockUserButton({
  blocked,
  targetDisplayName,
  targetUserId,
  onChanged,
}: BlockUserButtonProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'userBlocks' });
  const [effectiveBlocked, setEffectiveBlocked] = useState(blocked);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    setEffectiveBlocked(blocked);
  }, [blocked]);

  const performMutation = async (nextBlocked: boolean) => {
    const previousBlocked = effectiveBlocked;
    setEffectiveBlocked(nextBlocked);
    setIsMutating(true);

    try {
      if (nextBlocked) {
        await blockUser(targetUserId);
      } else {
        await unblockUser(targetUserId);
      }
    } catch (error: any) {
      setEffectiveBlocked(previousBlocked);
      setConfirmOpen(false);
      const message = error?.response?.data?.message || error?.message || t('mutationFailed');
      toast.error(t('mutationFailedWithReason', { error: message }));
      setIsMutating(false);
      return;
    }

    setConfirmOpen(false);
    toast.success(nextBlocked ? t('blockSuccess') : t('unblockSuccess'));

    const refreshResults = await Promise.allSettled([
      Promise.resolve().then(() => onChanged?.(nextBlocked)),
      refreshBlockAffectedCaches(),
    ]);
    if (refreshResults.some((result) => result.status === 'rejected')) {
      toast.error(t('refreshFailed'));
    }
    setIsMutating(false);
  };

  if (effectiveBlocked) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isMutating}
        aria-label={t('unblockAria', { user: targetDisplayName })}
        onClick={() => void performMutation(false)}
      >
        {isMutating && <Loader className="size-4 animate-spin" />}
        {isMutating ? t('unblocking') : t('unblock')}
      </Button>
    );
  }

  return (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <Button
        variant="destructive"
        size="sm"
        disabled={isMutating}
        aria-label={t('blockAria', { user: targetDisplayName })}
        onClick={() => setConfirmOpen(true)}
      >
        <UserRoundX className="size-4" />
        {t('block')}
      </Button>
      <DialogContent closeLabel={t('cancel')}>
        <DialogHeader>
          <DialogTitle>{t('confirmTitle', { user: targetDisplayName })}</DialogTitle>
          <DialogDescription>{t('confirmDescription')}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
          {t('publicContentNotice')}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isMutating}>
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={isMutating}
            onClick={() => void performMutation(true)}
          >
            {isMutating && <Loader className="size-4 animate-spin" />}
            {isMutating ? t('blocking') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
