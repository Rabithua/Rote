import Linkify from 'linkify-react';
import {
  Archive,
  ArrowDownLeft,
  Edit,
  Edit3,
  Ellipsis,
  Globe2Icon,
  Layers,
  LinkIcon,
  PinIcon,
  PinOff,
  Save,
  Share,
  Trash2,
  User,
} from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import mainJson from '@/json/main.json';
import { useEditor } from '@/state/editor';
import type { Profile, Rote, Rotes } from '@/types/main';
import { del, get, put } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { formatTimeAgo } from '@/utils/main';
import { useAtom } from 'jotai';
import moment from 'moment';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { Link } from 'react-router-dom';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';
import RoteEditor from './editor/RoteEditor';
import NoticeCreateBoard from './NoticeCreateBoard';
import RoteShareCard from './roteShareCard';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { SoftBottom } from './ui/SoftBottom';
const { roteContentExpandedLetter } = mainJson;

function RoteItem({
  rote,
  randomRoteStyle,
  mutate,
}: {
  rote: Rote;
  randomRoteStyle?: boolean;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
}) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteItem',
  });
  const { ref, inView } = useInView();

  const [, setRote] = useAtom(useEditor().editor_editRoteAtom);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isShareCardModalOpen, setIsShareCardModalOpen] = useState<boolean>(false);
  const [isNoticeCreateBoardModalOpen, setIsNoticeCreateBoardModalOpen] = useState<boolean>(false);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  function actionsMenu(rote: Rote) {
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
        })
        .catch(() => {
          toast.error(t('messages.editFailed'), {
            id: toastId,
          });
        });
    }
    return (
      <>
        <DropdownMenuItem asChild>
          <Link
            className="bg-foreground/3 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 font-semibold"
            to={`/rote/${rote.id}`}
          >
            <Layers className="size-4" />
            {t('details')}
          </Link>
        </DropdownMenuItem>
        {/* <DropdownMenuItem
          onSelect={() => {
            setIsNoticeCreateBoardModalOpen(true);
          }}
        >
          <Bell className="size-4" />
          {'回顾'}
        </DropdownMenuItem> */}
        <DropdownMenuItem onSelect={editRotePin}>
          {rote.pin ? <PinOff className="size-4" /> : <PinIcon className="size-4" />}
          {rote.pin ? t('unpinned') : t('pinned')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setRote(rote);
            setIsEditModalOpen(true);
          }}
        >
          <Edit3 className="size-4" />
          {t('edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={editRoteArchived}>
          <Save className="size-4" />
          {rote.archived ? t('unarchive') : t('archive')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setIsShareCardModalOpen(true);
          }}
        >
          <Share className="size-4" />
          {t('share')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={deleteRoteFn} className="text-red-500 focus:text-red-500">
          <Trash2 className="size-4 text-red-500" />
          {t('delete')}
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <div
      ref={ref}
      id={`Rote_${rote.id}`}
      className={`animate-show bg-background/5 flex w-full gap-4 opacity-0 duration-300 ${
        !randomRoteStyle && 'px-5 py-4'
      }`}
    >
      {!randomRoteStyle && (
        <Link className="text-primary hidden shrink-0 xl:block" to={`/${rote.author!.username}`}>
          <Avatar className="size-[40px] bg-[#00000010]">
            {rote.author!.username === profile?.username ? (
              profile?.avatar ? (
                <AvatarImage src={profile.avatar} />
              ) : (
                <AvatarFallback>
                  <User className="size-4 text-[#00000030]" />
                </AvatarFallback>
              )
            ) : rote.author!.avatar ? (
              <AvatarImage src={rote.author!.avatar} />
            ) : (
              <AvatarFallback>
                <User className="size-4 text-[#00000030]" />
              </AvatarFallback>
            )}
          </Avatar>
        </Link>
      )}

      <div className="flex flex-grow flex-col overflow-hidden">
        <div className="flex w-full cursor-default items-center gap-2">
          {!randomRoteStyle && (
            <Link
              className="shrink-0 cursor-pointer font-semibold hover:underline"
              to={`/${rote.author!.username}`}
            >
              {rote.author!.username === profile?.username
                ? profile?.nickname
                : rote.author!.nickname}
            </Link>
          )}

          <span className="noScrollBar text-info overflow-scroll font-normal text-nowrap">
            {!randomRoteStyle && (
              <>
                <Link to={`/${rote.author!.username}`}>{`@${rote.author!.username}`}</Link>
                <span>·</span>{' '}
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <span
                    className={`$${
                      new Date().getTime() - new Date(rote.createdAt).getTime() > 60 * 1000
                        ? ''
                        : 'text-theme'
                    }`}
                  >
                    {formatTimeAgo(rote.createdAt)}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>
                {moment.utc(rote.createdAt).format('YYYY/MM/DD HH:mm:ss')}
              </TooltipContent>
            </Tooltip>
          </span>

          <span className="text-info flex gap-1">
            {rote.pin ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PinIcon className={`size-4 cursor-pointer rounded-md`} />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  {rote.pin ? t('tooltips.pinned') : t('tooltips.unpinned')}
                </TooltipContent>
              </Tooltip>
            ) : null}

            {rote.state === 'public' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Globe2Icon className={`size-4 cursor-pointer rounded-md`} />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{t('tooltips.public')}</TooltipContent>
              </Tooltip>
            ) : null}

            {rote.archived ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Archive className={`size-4 cursor-pointer rounded-md`} />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{t('tooltips.archived')}</TooltipContent>
              </Tooltip>
            ) : null}

            {rote.updatedAt !== rote.createdAt ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Edit className={`size-4 cursor-pointer rounded-md`} />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  {moment.utc(rote.updatedAt).format('YYYY/MM/DD HH:mm:ss')}
                </TooltipContent>
              </Tooltip>
            ) : null}

            {rote.state === 'public' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <LinkIcon
                    className={`size-4 cursor-pointer rounded-md`}
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/rote/${rote.id}`);
                      toast.success(t('messages.copySuccess'));
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{t('tooltips.copyLink')}</TooltipContent>
              </Tooltip>
            ) : null}
          </span>
          {profile?.username === rote.author!.username && inView && mutate !== undefined && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Ellipsis className="hover:bg-foreground/3 fixed top-2 right-2 z-10 size-8 rounded-md p-2 backdrop-blur-xl duration-300" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50 min-w-[180px]">
                {actionsMenu(rote)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="font-zhengwen relative break-words whitespace-pre-line">
          <div className="aTagStyle">
            {rote.content.length > roteContentExpandedLetter ? (
              isExpanded ? (
                <Linkify>{rote.content}</Linkify>
              ) : (
                <Linkify>{`${rote.content.slice(0, roteContentExpandedLetter)}...`}</Linkify>
              )
            ) : (
              <Linkify>{rote.content}</Linkify>
            )}
          </div>

          {rote.content.length > roteContentExpandedLetter && (
            <>
              {!isExpanded && (
                <SoftBottom>
                  <div
                    className="pointer-events-auto flex cursor-pointer items-center justify-center gap-1"
                    onClick={toggleExpand}
                  >
                    <ArrowDownLeft className="size-4" />
                    {t('expand')}
                  </div>
                </SoftBottom>
              )}
            </>
          )}
        </div>

        {rote.attachments.length > 0 && (
          <div className="my-2 flex w-fit flex-wrap gap-1 overflow-hidden rounded-2xl">
            <PhotoProvider>
              {rote.attachments.map((file: any, index: any) => (
                <PhotoView key={`files_${index}`} src={file.url}>
                  <img
                    className={`${
                      rote.attachments.length % 3 === 0
                        ? 'aspect-square w-[calc(1/3*100%-2.6667px)]'
                        : rote.attachments.length % 2 === 0
                          ? 'aspect-square w-[calc(1/2*100%-2px)]'
                          : rote.attachments.length === 1
                            ? 'w-full max-w-[500px] rounded-2xl'
                            : 'aspect-square w-[calc(1/3*100%-2.6667px)]'
                    } bg-foreground/3 grow object-cover`}
                    src={file.compressUrl || file.url}
                    loading="lazy"
                    alt=""
                  />
                </PhotoView>
              ))}
            </PhotoProvider>
          </div>
        )}
        <div className="my-2 flex flex-wrap items-center gap-2">
          {rote.tags.map((tag: any) => (
            <Link
              key={tag}
              to={'/filter'}
              state={{
                tags: [tag],
              }}
            >
              <div className="bg-foreground/3 rounded-md px-2 py-1 text-xs duration-300 hover:scale-95">
                {tag}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {inView && (
        <>
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('edit')}</DialogTitle>
              </DialogHeader>
              <RoteEditor
                roteAtom={useEditor().editor_editRoteAtom}
                callback={() => {
                  setIsEditModalOpen(false);
                  if (mutate) {
                    mutate();
                  }
                }}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isShareCardModalOpen} onOpenChange={setIsShareCardModalOpen}>
            <DialogContent>
              <RoteShareCard rote={rote}></RoteShareCard>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isNoticeCreateBoardModalOpen}
            onOpenChange={setIsNoticeCreateBoardModalOpen}
          >
            <DialogContent className="block">
              <DialogHeader>
                <DialogTitle>{'创建提醒'}</DialogTitle>
              </DialogHeader>
              <NoticeCreateBoard />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default RoteItem;
