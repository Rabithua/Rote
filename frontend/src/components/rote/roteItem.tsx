import { useState } from 'react';

import { useAtom } from 'jotai';
import Linkify from 'linkify-react';
import { Archive, ArrowDownLeft, Edit, Globe2Icon, LinkIcon, PinIcon, User } from 'lucide-react';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import { Link } from 'react-router-dom';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

import NoticeCreateBoard from '@/components/rote/NoticeCreateBoard';
import RoteActionsMenu from '@/components/rote/RoteActionsMenu';
import RoteShareCard from '@/components/rote/roteShareCard';
import RoteEditor from '../editor/RoteEditor';
import { SoftBottom } from '../others/SoftBottom';
import { ReactionsPart } from './Reactions';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

import { useEditor } from '@/state/editor';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { formatTimeAgo } from '@/utils/main';

import mainJson from '@/json/main.json';
import type { Profile, Rote, Rotes } from '@/types/main';

import 'react-photo-view/dist/react-photo-view.css';
import type { KeyedMutator } from 'swr';

const { roteContentExpandedLetter } = mainJson;

function RoteItem({
  rote,
  randomRoteStyle,
  mutate,
  mutateSingle,
}: {
  rote: Rote;
  randomRoteStyle?: boolean;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  mutateSingle?: KeyedMutator<Rote>;
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
          {profile?.username === rote.author!.username &&
            inView &&
            (mutate !== undefined || mutateSingle !== undefined) && (
              <RoteActionsMenu
                rote={rote}
                mutate={mutate}
                mutateSingle={mutateSingle}
                onEdit={() => {
                  setRote(rote);
                  setIsEditModalOpen(true);
                }}
                onShare={() => setIsShareCardModalOpen(true)}
                onNoticeCreate={() => setIsNoticeCreateBoardModalOpen(true)}
              />
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
                            ? 'w-full max-w-[500px] rounded-2xl border-[0.5px]'
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
              <div className="bg-foreground/10 rounded-md px-2 py-1 text-xs duration-300 hover:scale-95">
                {tag}
              </div>
            </Link>
          ))}
        </div>

        <ReactionsPart rote={rote} mutate={mutate} mutateSingle={mutateSingle} />
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
                  if (mutateSingle) {
                    mutateSingle();
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
                <div className="flex items-center gap-4 border-b pb-4">
                  <h1 className="text-xl font-semibold">{t('noticeSubcription')}</h1>
                  <p className="text-info font-thin">{t('development')}</p>
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

export default RoteItem;
