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
} from 'lucide-react';
import moment from 'moment';
import { memo, useCallback, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ArticleCard } from '@/components/article/ArticleCard';
import RoteEditor from '@/components/editor/RoteEditor';
import { VerifiedIcon } from '@/components/icons/Verified';
import { SoftBottom } from '@/components/others/SoftBottom';
import UserAvatar from '@/components/others/UserAvatar';
import AttachmentsGrid from '@/components/rote/AttachmentsGrid';
import { LinkPreviewCard } from '@/components/rote/LinkPreviewCard';
import NoticeCreateBoard from '@/components/rote/NoticeCreateBoard';
import { ReactionsPart } from '@/components/rote/Reactions';
import RoteActionsMenu from '@/components/rote/RoteActionsMenu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useEditor } from '@/state/editor';
import { profileAtom } from '@/state/profile';
import type { Attachment, Rote, Rotes } from '@/types/main';
import { formatTimeAgo } from '@/utils/main';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

const roteContentExpandedLetter = 280;

function RoteItem({
  rote,
  mutate,
  mutateSingle,
  showAvatar = true,
  enableContentCollapse = true,
}: {
  rote: Rote;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  mutateSingle?: KeyedMutator<Rote>;
  showAvatar?: boolean;
  enableContentCollapse?: boolean;
}) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteItem',
  });
  const { ref, inView } = useInView();
  const [, setRote] = useAtom(useEditor().editor_editRoteAtom);
  const [modalType, setModalType] = useState<null | 'edit' | 'share' | 'notice'>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const profile = useAtomValue(profileAtom);

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
          <UserAvatar avatar={rote.author.avatar} className="size-10 bg-[#00000010]" />
        </Link>
      )}

      <div className="flex grow flex-col space-y-2 overflow-hidden">
        {/* Header */}
        <div className="flex w-full cursor-default items-center gap-2">
          <Link
            className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline"
            to={`/${rote.author.username}`}
          >
            {isOwner ? profile?.nickname : rote.author.nickname}
            {rote.author.emailVerified && <VerifiedIcon className="text-theme size-4 shrink-0" />}
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
                {moment(rote.createdAt).local().format('YYYY/MM/DD HH:mm:ss')}
              </TooltipContent>
            </Tooltip>
          </span>

          <span className="text-info flex gap-1">
            {rote.pin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PinIcon className="size-4 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{t('isPinned')}</TooltipContent>
              </Tooltip>
            )}

            {rote.state === 'public' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Globe2Icon className="size-4 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{t('isPublic')}</TooltipContent>
              </Tooltip>
            )}

            {rote.archived && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Archive className="size-4 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{t('isArchived')}</TooltipContent>
              </Tooltip>
            )}

            {rote.updatedAt !== rote.createdAt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Edit className="size-4 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  {moment(rote.updatedAt).local().format('YYYY/MM/DD HH:mm:ss')}
                </TooltipContent>
              </Tooltip>
            )}

            {rote.state === 'public' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <LinkIcon
                    className="size-4 cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/rote/${rote.id}`);
                      toast.success(t('linkCopied'));
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{t('copyLink')}</TooltipContent>
              </Tooltip>
            )}
          </span>

          {isOwner && inView && (mutate || mutateSingle) && (
            <RoteActionsMenu
              rote={rote}
              mutate={mutate}
              mutateSingle={mutateSingle}
              onEdit={onEdit}
              onShare={() => {
                const url = `${window.location.origin}/rote/${rote.id}`;
                navigator.clipboard.writeText(url);
                toast.success(t('linkCopied'));
              }}
              onNoticeCreate={() => setModalType('notice')}
            />
          )}
        </div>

        {/* Content */}
        <div className="font-zhengwen relative wrap-break-word whitespace-pre-line">
          <div className="font-semibold">{rote.title}</div>
          <div className="aTagStyle">
            {enableContentCollapse && rote.content.length > roteContentExpandedLetter ? (
              isExpanded ? (
                <Linkify>{rote.content}</Linkify>
              ) : (
                <Linkify>{`${rote.content.slice(0, roteContentExpandedLetter)}...`}</Linkify>
              )
            ) : (
              <Linkify>{rote.content}</Linkify>
            )}
          </div>
          {enableContentCollapse &&
            rote.content.length > roteContentExpandedLetter &&
            !isExpanded && (
              <SoftBottom>
                <div
                  className="pointer-events-auto flex cursor-pointer items-center justify-center gap-1"
                  onClick={() => setIsExpanded(true)}
                >
                  <ArrowDownLeft className="size-4" /> {t('expand')}
                </div>
              </SoftBottom>
            )}
        </div>

        {/* Article reference */}
        {rote.article && (
          <div className="flex flex-col gap-2">
            <ArticleCard
              key={rote.articleId || rote.article.id}
              article={rote.article}
              articleId={rote.articleId || rote.article.id}
              noteId={rote.id}
              enableViewer
              className="w-full"
            />
          </div>
        )}

        {!rote.articleId &&
          !rote.article &&
          (rote.attachments?.length || 0) === 0 &&
          (rote.linkPreviews?.length || 0) > 0 && (
            <div className="flex flex-col gap-2">
              {rote.linkPreviews?.map((preview) => (
                <LinkPreviewCard key={preview.id} preview={preview} />
              ))}
            </div>
          )}

        {/* Attachments */}
        {rote.attachments?.length > 0 && (
          <AttachmentsGrid
            attachments={rote.attachments.filter((a): a is Attachment => !(a instanceof File))}
          />
        )}

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
                <DialogTitle>{t('edit')}</DialogTitle>
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

          <Dialog open={modalType === 'notice'} onOpenChange={() => setModalType(null)}>
            <DialogContent className="block">
              <DialogHeader>
                <div className="flex items-center gap-4 border-b pb-4">
                  <h1 className="text-xl font-semibold">{t('subscriptionReminder')}</h1>
                  <p className="text-info font-thin">{t('inDevelopment')}</p>
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
