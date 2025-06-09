import { Bell, Edit3, Ellipsis, Layers, PinIcon, PinOff, Save, Share, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Rote, Rotes } from '@/types/main';
import { del, put } from '@/utils/api';
import type { KeyedMutator } from 'swr';

interface RoteActionsMenuProps {
  rote: Rote;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  mutateSingle?: KeyedMutator<Rote>;
  onEdit: () => void;
  onShare: () => void;
  onNoticeCreate?: () => void;
}

export default function RoteActionsMenu({
  rote,
  mutate,
  mutateSingle,
  onEdit,
  onShare,
  onNoticeCreate,
}: RoteActionsMenuProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteItem',
  });

  function deleteRoteFn() {
    const toastId = toast.loading(t('messages.deleting'));
    del('/notes/' + rote.id)
      .then(() => {
        toast.success(t('messages.deleteSuccess'), {
          id: toastId,
        });

        if (mutate) {
          mutate(
            (currentData) =>
              // 处理嵌套数组结构
              currentData?.map((page) =>
                Array.isArray(page) ? page.filter((r) => r.id !== rote.id) : page
              ) as Rotes,
            {
              revalidate: false,
            }
          );
        }

        if (mutateSingle) {
          mutateSingle();
        }
      })
      .catch(() => {
        toast.error(t('messages.deleteFailed'), {
          id: toastId,
        });
      });
  }

  function editRotePin() {
    const toastId = toast.loading(t('messages.editing'));
    put('/notes/' + rote.id, {
      id: rote.id,
      authorid: rote.authorid,
      pin: !rote.pin,
    })
      .then((res) => {
        toast.success(
          `${rote.pin ? t('unpinned') : t('pinned')}${t('messages.editSuccess', '成功')}`,
          {
            id: toastId,
          }
        );

        if (mutate) {
          mutate(
            (currentData) =>
              // 处理嵌套数组结构
              currentData?.map((page) =>
                Array.isArray(page) ? page.map((r) => (r.id === rote.id ? res.data : r)) : page
              ) as Rotes,
            {
              revalidate: false,
            }
          );
        }

        if (mutateSingle) {
          mutateSingle(() => res.data, {
            revalidate: false,
          });
        }
      })
      .catch(() => {
        toast.error(t('messages.editFailed'), {
          id: toastId,
        });
      });
  }

  function editRoteArchived() {
    const toastId = toast.loading(t('messages.editing'));
    put('/notes/' + rote.id, {
      id: rote.id,
      authorid: rote.authorid,
      archived: !rote.archived,
    })
      .then((res) => {
        toast.success(
          `${rote.archived ? t('unarchive') : t('archive')}${t('messages.editSuccess')}`,
          {
            id: toastId,
          }
        );

        if (mutate) {
          mutate(
            (currentData) =>
              // 处理嵌套数组结构
              currentData?.map((page) =>
                Array.isArray(page) ? page.map((r) => (r.id === rote.id ? res.data : r)) : page
              ) as Rotes,
            {
              revalidate: false,
            }
          );
        }

        if (mutateSingle) {
          mutateSingle(() => res.data, {
            revalidate: false,
          });
        }
      })
      .catch(() => {
        toast.error(t('messages.editFailed'), {
          id: toastId,
        });
      });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Ellipsis className="hover:bg-foreground/3 fixed top-2 right-2 z-10 size-8 rounded-md p-2 backdrop-blur-xl duration-300" />
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

        {/* 取消注释以启用提醒功能 */}
        {onNoticeCreate && (
          <DropdownMenuItem onSelect={onNoticeCreate}>
            <Bell className="size-4" />
            {'回顾'}
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

        <DropdownMenuItem onSelect={onShare}>
          <Share className="size-4" />
          {t('share')}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={deleteRoteFn} className="text-red-500 focus:text-red-500">
          <Trash2 className="size-4 text-red-500" />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
