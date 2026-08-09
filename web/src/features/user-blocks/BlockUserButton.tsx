import { Button } from '@/components/ui/button';
import BlockUserConfirmDialog from './BlockUserConfirmDialog';
import { useUserBlockAction } from './useUserBlockAction';
import { Loader, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const {
    confirmBlock,
    confirmOpen,
    effectiveBlocked,
    isMutating,
    requestBlock,
    setConfirmOpen,
    unblock,
  } = useUserBlockAction({
    blocked,
    targetUserId,
    onChanged,
  });

  if (effectiveBlocked) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isMutating}
        aria-label={t('unblockAria', { user: targetDisplayName })}
        onClick={() => void unblock()}
      >
        {isMutating && <Loader className="size-4 animate-spin" />}
        {isMutating ? t('unblocking') : t('unblock')}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        disabled={isMutating}
        aria-label={t('blockAria', { user: targetDisplayName })}
        onClick={requestBlock}
      >
        <UserRoundX className="size-4" />
        {t('block')}
      </Button>
      <BlockUserConfirmDialog
        open={confirmOpen}
        isMutating={isMutating}
        targetDisplayName={targetDisplayName}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmBlock}
      />
    </>
  );
}
