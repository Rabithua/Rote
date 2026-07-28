import { Ellipsis, Loader, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import BlockUserConfirmDialog from './BlockUserConfirmDialog';
import { useUserBlockAction } from './useUserBlockAction';

interface UserBlockMenuProps {
  blocked: boolean;
  targetDisplayName: string;
  targetUserId: string;
  onChanged?: (blocked: boolean) => void | Promise<void>;
}

export default function UserBlockMenu({
  blocked,
  targetDisplayName,
  targetUserId,
  onChanged,
}: UserBlockMenuProps) {
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={t('menuAria', { user: targetDisplayName })}
            title={t('menuAria', { user: targetDisplayName })}
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isMutating}
            variant={effectiveBlocked ? 'default' : 'destructive'}
            onSelect={() => {
              if (effectiveBlocked) {
                void unblock();
                return;
              }
              requestBlock();
            }}
          >
            {isMutating ? (
              <Loader className="size-4 animate-spin" />
            ) : effectiveBlocked ? (
              <UserRoundCheck className="size-4" />
            ) : (
              <UserRoundX className="size-4" />
            )}
            {isMutating
              ? effectiveBlocked
                ? t('unblocking')
                : t('blocking')
              : effectiveBlocked
                ? t('unblock')
                : t('block')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
