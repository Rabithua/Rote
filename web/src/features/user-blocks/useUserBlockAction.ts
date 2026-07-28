import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { blockUser, unblockUser } from './api';
import { refreshBlockAffectedCaches } from './cache';

interface UseUserBlockActionOptions {
  blocked: boolean;
  targetUserId: string;
  onChanged?: (blocked: boolean) => void | Promise<void>;
}

interface UserBlockActionState {
  confirmOpen: boolean;
  effectiveBlocked: boolean;
  sourceBlocked: boolean;
  targetUserId: string;
}

export function useUserBlockAction({
  blocked,
  targetUserId,
  onChanged,
}: UseUserBlockActionOptions) {
  const { t } = useTranslation('translation', { keyPrefix: 'userBlocks' });
  const [blockState, setBlockState] = useState<UserBlockActionState>({
    confirmOpen: false,
    effectiveBlocked: blocked,
    sourceBlocked: blocked,
    targetUserId,
  });
  const [isMutating, setIsMutating] = useState(false);

  if (blockState.sourceBlocked !== blocked || blockState.targetUserId !== targetUserId) {
    setBlockState({
      confirmOpen: false,
      effectiveBlocked: blocked,
      sourceBlocked: blocked,
      targetUserId,
    });
  }

  const setConfirmOpen = useCallback((open: boolean) => {
    setBlockState((current) => ({ ...current, confirmOpen: open }));
  }, []);

  const performMutation = useCallback(
    async (nextBlocked: boolean) => {
      const previousBlocked = blockState.effectiveBlocked;
      setBlockState((current) => ({
        ...current,
        effectiveBlocked: nextBlocked,
      }));
      setIsMutating(true);

      try {
        if (nextBlocked) {
          await blockUser(targetUserId);
        } else {
          await unblockUser(targetUserId);
        }
      } catch (error: unknown) {
        setBlockState((current) => ({
          ...current,
          confirmOpen: false,
          effectiveBlocked: previousBlocked,
        }));
        const responseMessage = (
          error as { response?: { data?: { message?: string } }; message?: string }
        )?.response?.data?.message;
        const message =
          responseMessage ||
          (error instanceof Error ? error.message : undefined) ||
          t('mutationFailed');
        toast.error(t('mutationFailedWithReason', { error: message }));
        setIsMutating(false);
        return;
      }

      setConfirmOpen(false);
      toast.success(nextBlocked ? t('blockSuccess') : t('unblockSuccess'));

      const changeResults = await Promise.allSettled([
        Promise.resolve().then(() => onChanged?.(nextBlocked)),
      ]);
      const refreshResults = await Promise.allSettled([
        Promise.resolve().then(refreshBlockAffectedCaches),
      ]);
      if ([...changeResults, ...refreshResults].some((result) => result.status === 'rejected')) {
        toast.error(t('refreshFailed'));
      }
      setIsMutating(false);
    },
    [blockState.effectiveBlocked, onChanged, setConfirmOpen, t, targetUserId]
  );

  const requestBlock = useCallback(() => {
    setConfirmOpen(true);
  }, [setConfirmOpen]);

  const confirmBlock = useCallback(() => performMutation(true), [performMutation]);
  const unblock = useCallback(() => performMutation(false), [performMutation]);

  return {
    confirmBlock,
    confirmOpen: blockState.confirmOpen,
    effectiveBlocked: blockState.effectiveBlocked,
    isMutating,
    requestBlock,
    setConfirmOpen,
    unblock,
  };
}
