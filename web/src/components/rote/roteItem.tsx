// RoteItem.tsx（合并优化版）
import { useAtom } from 'jotai';
import Linkify from 'linkify-react';
import {
  Archive,
  ArrowDownLeft,
  Edit,
  Globe2Icon,
  LinkIcon,
  PinIcon,
  SmilePlus,
  User,
} from 'lucide-react';
import moment from 'moment';
import { memo, useCallback, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import RoteEditor from '@/components/editor/RoteEditor';
import { SoftBottom } from '@/components/others/SoftBottom';
import AttachmentsGrid from '@/components/rote/AttachmentsGrid';
import NoticeCreateBoard from '@/components/rote/NoticeCreateBoard';
import { ReactionsPart } from '@/components/rote/Reactions';
import RoteActionsMenu from '@/components/rote/RoteActionsMenu';
import RoteShareCard from '@/components/rote/roteShareCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useEditor } from '@/state/editor';
import type { Profile, Rote, Rotes } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { formatTimeAgo } from '@/utils/main';
import type { KeyedMutator } from 'swr';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

const roteContentExpandedLetter = 280;

function RoteItem({
  rote,
  mutate,
  mutateSingle,
  showAvatar = true,
}: {
  rote: Rote;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  mutateSingle?: KeyedMutator<Rote>;
  showAvatar?: boolean;
}) {
  const { ref, inView } = useInView();
  const [, setRote] = useAtom(useEditor().editor_editRoteAtom);
  const [modalType, setModalType] = useState<null | 'edit' | 'share' | 'notice'>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const isOwner = profile?.username === rote.author.username;

  const onEdit = useCallback(() => {
    setRote(rote);
    setModalType('edit');
  }, [rote]);

  return (
    <div
      ref={ref}
      id={`Rote_${rote.id}`}
      className="animate-show bg-background/5 flex w-full gap-4 px-5 py-4 opacity-0 duration-300"
    >
      {showAvatar && (
        <Link className="text-primary hidden shrink-0 xl:block" to={`/${rote.author.username}`}>
          <Avatar className="size-[40px] bg-[#00000010]">
            {rote.author.avatar ? (
              <AvatarImage src={rote.author.avatar} />
            ) : (
              <AvatarFallback>
                <User className="size-4 text-[#00000030]" />
              </AvatarFallback>
            )}
          </Avatar>
        </Link>
      )}

      <div className="flex flex-grow flex-col space-y-2 overflow-hidden">
        {/* Header */}
        <div className="flex w-full cursor-default items-center gap-2">
          <Link className="shrink-0 font-semibold hover:underline" to={`/${rote.author.username}`}>
            {isOwner ? profile?.nickname : rote.author.nickname}
          </Link>

          <span className="noScrollBar text-info overflow-scroll font-normal text-nowrap">
            <Link to={`/${rote.author.username}`}>{`@${rote.author.username}`}</Link>
            <span>·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <span
                    className={
                      new Date().getTime() - new Date(rote.createdAt).getTime() > 60 * 1000
                        ? ''
                        : 'text-theme'
                    }
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
            {rote.pin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PinIcon className="size-4 cursor-pointer rounded-md" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>已置顶</TooltipContent>
              </Tooltip>
            )}

            {rote.state === 'public' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Globe2Icon className="size-4 cursor-pointer rounded-md" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>公开</TooltipContent>
              </Tooltip>
            )}

            {rote.archived && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Archive className="size-4 cursor-pointer rounded-md" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>已归档</TooltipContent>
              </Tooltip>
            )}

            {rote.updatedAt !== rote.createdAt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Edit className="size-4 cursor-pointer rounded-md" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  {moment.utc(rote.updatedAt).format('YYYY/MM/DD HH:mm:ss')}
                </TooltipContent>
              </Tooltip>
            )}

            {rote.state === 'public' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <LinkIcon
                    className="size-4 cursor-pointer rounded-md"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/rote/${rote.id}`);
                      toast.success('已复制链接');
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>复制链接</TooltipContent>
              </Tooltip>
            )}
          </span>

          {isOwner && inView && (mutate || mutateSingle) && (
            <RoteActionsMenu
              rote={rote}
              mutate={mutate}
              mutateSingle={mutateSingle}
              onEdit={onEdit}
              onShare={() => setModalType('share')}
              onNoticeCreate={() => setModalType('notice')}
            />
          )}
        </div>

        {/* Content */}
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
          {rote.content.length > roteContentExpandedLetter && !isExpanded && (
            <SoftBottom>
              <div
                className="pointer-events-auto flex cursor-pointer items-center justify-center gap-1"
                onClick={() => setIsExpanded(true)}
              >
                <ArrowDownLeft className="size-4" /> 展开
              </div>
            </SoftBottom>
          )}
        </div>

        {/* Attachments */}
        {rote.attachments?.length > 0 && <AttachmentsGrid attachments={rote.attachments} />}

        {/* Tags */}
        {rote.tags?.length > 0 && (
          <div className="my-2 flex flex-wrap items-center gap-2">
            {rote.tags.map((tag) => (
              <Link key={tag} to="/filter" state={{ tags: [tag] }}>
                <div className="bg-foreground/5 rounded-md px-2 py-1 text-xs duration-300 hover:scale-95">
                  {tag}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Reactions */}
        {inView ? (
          <ReactionsPart rote={rote} mutate={mutate} mutateSingle={mutateSingle} />
        ) : (
          <SmilePlus className="bg-foreground/5 ml-auto size-6 cursor-pointer rounded-2xl p-1 duration-300 hover:scale-110" />
        )}
      </div>

      {inView && (
        <>
          <Dialog open={modalType === 'edit'} onOpenChange={() => setModalType(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>编辑</DialogTitle>
              </DialogHeader>
              <RoteEditor
                roteAtom={useEditor().editor_editRoteAtom}
                callback={() => {
                  setModalType(null);
                  mutate?.();
                  mutateSingle?.();
                }}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={modalType === 'share'} onOpenChange={() => setModalType(null)}>
            <DialogContent>
              <RoteShareCard rote={rote} />
            </DialogContent>
          </Dialog>

          <Dialog open={modalType === 'notice'} onOpenChange={() => setModalType(null)}>
            <DialogContent className="block">
              <DialogHeader>
                <div className="flex items-center gap-4 border-b pb-4">
                  <h1 className="text-xl font-semibold">订阅提醒</h1>
                  <p className="text-info font-thin">开发中</p>
                </div>
              </DialogHeader>
              <NoticeCreateBoard />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default memo(RoteItem);
