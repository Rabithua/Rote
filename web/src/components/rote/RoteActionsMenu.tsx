import {
  Bell,
  Edit3,
  Ellipsis,
  Image,
  Layers,
  Loader,
  PinIcon,
  PinOff,
  Save,
  Share,
  Trash2,
  UserRoundX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import BlockUserConfirmDialog from '@/features/user-blocks/BlockUserConfirmDialog';
import { useUserBlockAction } from '@/features/user-blocks/useUserBlockAction';
import { useNoteExport } from '@/hooks/useNoteExport';
import type { Attachment, Rote, Rotes } from '@/types/main';
import { del, put } from '@/utils/api';
import type { KeyedMutator } from 'swr';

interface RoteActionsMenuProps {
  rote: Rote;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  mutateSingle?: KeyedMutator<Rote>;
  onEdit: () => void;
  onShare: () => void;
  onNoticeCreate?: () => void;
  isOwner?: boolean;
  blockTarget?: {
    blocked?: boolean;
    displayName: string;
    id: string;
  };
  onBlockChanged?: (blocked: boolean) => void | Promise<void>;
}

export default function RoteActionsMenu({
  rote,
  mutate,
  mutateSingle,
  onEdit,
  onShare,
  onNoticeCreate,
  isOwner = true,
  blockTarget,
  onBlockChanged,
}: RoteActionsMenuProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteItem',
  });
  const { t: tUserBlocks } = useTranslation('translation', {
    keyPrefix: 'userBlocks',
  });
  const { exporting, handleExportImage } = useNoteExport();
  const blockAction = useUserBlockAction({
    blocked: blockTarget?.blocked === true,
    targetUserId: blockTarget?.id || '',
    onChanged: onBlockChanged,
  });

  /**
   * Rote 操作相关的辅助函数集合
   */
  const roteHelpers = {
    // 更新本地状态 - 删除操作
    updateLocalRoteDelete() {
      if (mutate) {
        mutate(
          (currentData) =>
            currentData?.map((page) =>
              Array.isArray(page) ? page.filter((r) => r.id !== rote.id) : page
            ) as Rotes,
          { revalidate: false }
        );
      }

      if (mutateSingle) {
        mutateSingle();
      }
    },

    // 更新本地状态 - 编辑操作
    updateLocalRoteEdit(updatedRote: Rote) {
      if (mutate) {
        mutate(
          (currentData) =>
            currentData?.map((page) =>
              Array.isArray(page) ? page.map((r) => (r.id === rote.id ? updatedRote : r)) : page
            ) as Rotes,
          { revalidate: false }
        );
      }

      if (mutateSingle) {
        mutateSingle(() => updatedRote, { revalidate: false });
      }
    },

    // 执行 API 请求并处理本地状态更新
    async executeRoteAction(
      action: () => Promise<any>,
      onSuccess: (_res?: any) => void,
      loadingMessage: string,
      successMessage: string,
      errorMessage: string
    ) {
      const toastId = toast.loading(loadingMessage);

      try {
        const res = await action();
        toast.success(successMessage, { id: toastId });
        onSuccess(res);
      } catch {
        toast.error(errorMessage, { id: toastId });
      }
    },
  };

  function deleteRoteFn() {
    roteHelpers.executeRoteAction(
      () => del('/notes/' + rote.id),
      () => roteHelpers.updateLocalRoteDelete(),
      t('messages.deleting'),
      t('messages.deleteSuccess'),
      t('messages.deleteFailed')
    );
  }

  function editRotePin() {
    roteHelpers.executeRoteAction(
      () =>
        put('/notes/' + rote.id, {
          id: rote.id,
          authorid: rote.authorid,
          pin: !rote.pin,
        }),
      (res) => roteHelpers.updateLocalRoteEdit(res.data),
      t('messages.editing'),
      `${rote.pin ? t('unpinned') : t('pinned')}${t('messages.editSuccess', '成功')}`,
      t('messages.editFailed')
    );
  }

  function editRoteArchived() {
    roteHelpers.executeRoteAction(
      () =>
        put('/notes/' + rote.id, {
          id: rote.id,
          authorid: rote.authorid,
          archived: !rote.archived,
        }),
      (res) => roteHelpers.updateLocalRoteEdit(res.data),
      t('messages.editing'),
      `${rote.archived ? t('unarchive') : t('archive')}${t('messages.editSuccess')}`,
      t('messages.editFailed')
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('actions', 'Actions')}
            title={t('actions', 'Actions')}
            className="hover:bg-background/80 ml-auto size-8 shrink-0 rounded-md p-2 duration-300"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 min-w-[180px]">
          <DropdownMenuItem asChild>
            <Link
              className="bg-foreground/3 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 font-semibold"
              to={`/rote/${rote.id}`}
            >
              <Layers className="size-4" />
              {t('details')}
            </Link>
          </DropdownMenuItem>

          {isOwner && (
            <>
              {onNoticeCreate && (
                <DropdownMenuItem onSelect={onNoticeCreate}>
                  <Bell className="size-4" />
                  {t('review')}
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onSelect={editRotePin}>
                {rote.pin ? <PinOff className="size-4" /> : <PinIcon className="size-4" />}
                {rote.pin ? t('unpinned') : t('pinned')}
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={onEdit}>
                <Edit3 className="size-4" />
                {t('edit')}
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={editRoteArchived}>
                <Save className="size-4" />
                {rote.archived ? t('unarchive') : t('archive')}
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => {
                  if (rote.state === 'private') {
                    toast(t('messages.privateNoteCannotShare'), {
                      description: t('messages.privateNoteShareDescription'),
                      action: {
                        label: t('messages.setPublicAndShare'),
                        onClick: () => {
                          roteHelpers.executeRoteAction(
                            () =>
                              put('/notes/' + rote.id, {
                                id: rote.id,
                                authorid: rote.authorid,
                                state: 'public',
                              }),
                            (res) => {
                              roteHelpers.updateLocalRoteEdit(res.data);
                              onShare();
                            },
                            t('messages.editing'),
                            t('messages.editSuccess'),
                            t('messages.editFailed')
                          );
                        },
                      },
                    });
                    return;
                  }
                  onShare();
                }}
              >
                <Share className="size-4" />
                {t('share')}
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => {
                  const imageAttachments = rote.attachments
                    ?.filter((a): a is Attachment => !(a instanceof File))
                    .sort((a, b) => (a.sortIndex > b.sortIndex ? 1 : -1));
                  let articleTitle: string | undefined;
                  if (rote.article?.content) {
                    const match = rote.article.content.match(/^\s*#\s+([^\n]+)/);
                    articleTitle = match ? match[1].trim() : undefined;
                  }
                  handleExportImage({
                    title: rote.title,
                    content: rote.content,
                    noteId: rote.id,
                    author: rote.author,
                    tags: rote.tags,
                    attachments: imageAttachments,
                    articleTitle,
                  });
                }}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <Image className="size-4" />
                )}
                {exporting ? t('exporting') : t('exportImage')}
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={deleteRoteFn} className="text-red-500 focus:text-red-500">
                <Trash2 className="size-4 text-red-500" />
                {t('delete')}
              </DropdownMenuItem>
            </>
          )}

          {blockTarget && (
            <DropdownMenuItem
              variant="destructive"
              disabled={blockAction.isMutating}
              onSelect={blockAction.requestBlock}
            >
              <UserRoundX className="size-4" />
              {tUserBlocks('block')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {blockTarget && (
        <BlockUserConfirmDialog
          open={blockAction.confirmOpen}
          isMutating={blockAction.isMutating}
          targetDisplayName={blockTarget.displayName}
          onOpenChange={blockAction.setConfirmOpen}
          onConfirm={blockAction.confirmBlock}
        />
      )}
    </>
  );
}
