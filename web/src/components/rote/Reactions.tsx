import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  availablePreReactions,
  defaultAnonymousPreReactions,
  mayCreateCustomReaction,
  mayToggleReaction,
} from '@/features/reactions/policy';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { useAuthState } from '@/state/profile';
import { visitorIdAtom } from '@/state/visitorId';
import type { Reaction, Rote, Rotes } from '@/types/main';
import { del, post } from '@/utils/api';
import { useAtom } from 'jotai';
import { Loader, SmilePlus, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { KeyedMutator } from 'swr';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

// 类型定义
interface ReactionData {
  type: string;
  roteid: string;
  metadata: { source: string };
  visitorId?: string;
  visitorInfo?: any;
}

interface ReactionsPartProps {
  rote: Rote;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  mutateSingle?: KeyedMutator<Rote>;
}

export function ReactionsPart({ rote, mutate, mutateSingle }: ReactionsPartProps) {
  const { authReady, isAuthenticated, isAuthPending, profile } = useAuthState();
  const { data: siteStatus } = useSiteStatus();
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.reactions',
  });
  const preReactions = siteStatus?.frontendConfig?.preReactions ?? [];
  const anonymousPreReactions: readonly string[] =
    siteStatus?.frontendConfig?.anonymousPreReactions ?? defaultAnonymousPreReactions;
  const pickerReactions = availablePreReactions(
    isAuthenticated,
    preReactions,
    siteStatus?.frontendConfig?.anonymousPreReactions
  );
  const hasReactionPicker = isAuthenticated || pickerReactions.length > 0;

  const [open, setOpen] = useState(false);
  const [visitorId, setVisitorId] = useAtom(visitorIdAtom);
  const isReactionIdentityReady = isAuthenticated || Boolean(visitorId);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisitorIdLoading, setIsVisitorIdLoading] = useState(false);

  const [showInlineInput, setShowInlineInput] = useState(false);
  const [customReaction, setCustomReaction] = useState('');

  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = React.useRef(false);

  const startLongPress = (e: React.PointerEvent) => {
    if (!mayCreateCustomReaction(isAuthenticated)) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowInlineInput(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(30);
        } catch {}
      }
    }, 2000); // 2s threshold as requested
  };

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowInlineInput(false);
      setCustomReaction('');
    }
  };

  const handleInlineBlur = () => {
    setShowInlineInput(false);
    setCustomReaction('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length > 24) {
      toast.warning(t('limitExceeded'));
      setCustomReaction(value.slice(0, 24));
    } else {
      setCustomReaction(value);
    }
  };

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mayCreateCustomReaction(isAuthenticated) || isLoading || !customReaction.trim()) {
      setShowInlineInput(false);
      setCustomReaction('');
      return;
    }

    const reactionType = customReaction.trim();
    setShowInlineInput(false);
    setCustomReaction('');

    await handleReactionClick(reactionType);
  };

  React.useEffect(() => {
    if (authReady && !isAuthenticated && !visitorId) {
      setIsVisitorIdLoading(true);
      import('@/utils/deviceFingerprint')
        .then(({ generateVisitorId }) => generateVisitorId().then(setVisitorId))
        .finally(() => setIsVisitorIdLoading(false));
    }
  }, [authReady, isAuthenticated, visitorId, setVisitorId]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setShowInlineInput(false);
      setCustomReaction('');
    }
  }, [isAuthenticated]);

  const groupedReactions = rote.reactions.reduce(
    (acc, reaction) => {
      acc[reaction.type] = acc[reaction.type] || [];
      acc[reaction.type].push(reaction);
      return acc;
    },
    {} as Record<string, Reaction[]>
  );

  const handleReactionClick = async (reactionType: string) => {
    if (isAuthPending || !isReactionIdentityReady) {
      return;
    }

    const existingReaction = isAuthenticated
      ? rote.reactions.find((r) => r.type === reactionType && r.userid === profile?.id)
      : visitorId
        ? rote.reactions.find((r) => r.type === reactionType && r.visitorId === visitorId)
        : undefined;

    if (
      !mayToggleReaction({
        isAuthenticated,
        isAllowedAnonymousType: anonymousPreReactions.includes(reactionType),
        hasOwnReaction: Boolean(existingReaction),
      })
    ) {
      return;
    }

    setOpen(false);
    setIsLoading(true);

    try {
      if (existingReaction) {
        await del(
          isAuthenticated
            ? `/reactions/${rote.id}/${reactionType}`
            : `/reactions/${rote.id}/${reactionType}?visitorId=${encodeURIComponent(visitorId!)}`
        );

        const newReactions = rote.reactions.filter((r) => r.id !== existingReaction.id);
        mutate?.(
          (data) =>
            data?.map((page) =>
              Array.isArray(page)
                ? page.map((r) => (r.id === rote.id ? { ...r, reactions: newReactions } : r))
                : page
            ) as Rotes,
          { revalidate: false }
        );
        mutateSingle?.((current) => current && { ...current, reactions: newReactions }, {
          revalidate: false,
        });
      } else {
        const reactionData: ReactionData = {
          type: reactionType,
          roteid: rote.id,
          metadata: { source: 'web' },
        };

        if (!isAuthenticated && visitorId) {
          const { getVisitorInfo } = await import('@/utils/deviceFingerprint');
          reactionData.visitorId = visitorId;
          reactionData.visitorInfo = getVisitorInfo();
        }

        const response = await post('/reactions', reactionData);
        const newReactions = [...rote.reactions, response.data];

        mutate?.(
          (data) =>
            data?.map((page) =>
              Array.isArray(page)
                ? page.map((r) => (r.id === rote.id ? { ...r, reactions: newReactions } : r))
                : page
            ) as Rotes,
          { revalidate: false }
        );
        mutateSingle?.((current) => current && { ...current, reactions: newReactions }, {
          revalidate: false,
        });
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(groupedReactions).map(([type, reactionGroup]) => {
          const hasUserReactions = reactionGroup.some((r) => r.user);
          const isCustomReaction = !preReactions.includes(type);
          const firstUser = isCustomReaction ? reactionGroup.find((r) => r.user)?.user : null;
          const hasOwnReaction = isAuthenticated
            ? reactionGroup.some((reaction) => reaction.userid === profile?.id)
            : Boolean(visitorId) &&
              reactionGroup.some((reaction) => reaction.visitorId === visitorId);
          const isInteractive =
            isReactionIdentityReady &&
            mayToggleReaction({
              isAuthenticated,
              isAllowedAnonymousType: anonymousPreReactions.includes(type),
              hasOwnReaction,
            });

          const ReactionButton = (
            <div
              className={`flex h-6 ${
                isLoading || !isInteractive ? 'cursor-not-allowed' : 'cursor-pointer'
              } items-center gap-1.5 rounded-full ${
                firstUser ? 'pr-2.5 pl-1' : 'px-2 pr-3'
              } text-xs duration-300 ${
                (
                  isAuthenticated
                    ? rote.reactions.some((r) => r.type === type && r.userid === profile?.id)
                    : Boolean(visitorId) &&
                      rote.reactions.some((r) => r.type === type && r.visitorId === visitorId)
                )
                  ? 'border-theme/30 bg-theme/10 text-theme hover:bg-theme/30 border-[0.5px]'
                  : 'bg-foreground/5 hover:bg-foreground/5'
              }`}
              onClick={() => (isLoading || !isInteractive ? undefined : handleReactionClick(type))}
            >
              {firstUser && (
                <Link
                  to={`/${firstUser.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
                  title={firstUser.nickname || firstUser.username}
                >
                  <Avatar className="size-4">
                    <AvatarImage src={firstUser.avatar || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {firstUser.nickname?.[0] || firstUser.username[0]}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
              <span>{type}</span>
              <SlidingNumber className="text-xs" number={reactionGroup.length} />
            </div>
          );

          if (!hasUserReactions) {
            return <React.Fragment key={type}>{ReactionButton}</React.Fragment>;
          }

          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>{ReactionButton}</TooltipTrigger>
              <TooltipContent className="p-2">
                <div className="flex flex-row items-center -space-x-2">
                  {reactionGroup.map(
                    (reaction) =>
                      reaction.user && (
                        <Link
                          to={`/${reaction.user.username}`}
                          key={reaction.id}
                          className="flex cursor-pointer items-center transition-transform hover:scale-110"
                          title={reaction.user.nickname || reaction.user.username}
                        >
                          <Avatar className="size-5">
                            <AvatarImage src={reaction.user.avatar || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {reaction.user.nickname?.[0] || reaction.user.username[0]}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      )
                  )}
                  {reactionGroup.filter((r) => !r.user).length > 0 && (
                    <div className="border-background ring-foreground/10 bg-muted text-muted-foreground flex size-5 cursor-not-allowed items-center justify-center rounded-full border-2 text-[10px] ring-1">
                      <UserIcon className="size-3" />
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {mayCreateCustomReaction(isAuthenticated) && showInlineInput ? (
        <form
          onSubmit={handleInlineSubmit}
          className="bg-foreground/5 flex h-6 w-32 items-center rounded-2xl px-1.5 transition-all duration-300 focus-within:w-36"
        >
          <SmilePlus className="mr-1 size-4 shrink-0 opacity-60" />
          <input
            type="text"
            value={customReaction}
            onChange={handleInputChange}
            onKeyDown={handleInlineKeyDown}
            onBlur={handleInlineBlur}
            placeholder={t('placeholder')}
            className="inputOrTextAreaInit h-full w-full border-none bg-transparent p-0 text-sm! shadow-none outline-none focus:border-none focus:ring-0 focus:outline-none"
            autoFocus
          />
        </form>
      ) : hasReactionPicker ? (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!isReactionIdentityReady}
              className="transition-transform select-none focus:outline-none active:scale-95"
              style={{
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: 'none',
              }}
              onPointerDown={startLongPress}
              onPointerUp={endLongPress}
              onPointerCancel={endLongPress}
              onClick={handleTriggerClick}
              onContextMenu={(e) => e.preventDefault()}
            >
              {isLoading || isAuthPending || (!isAuthenticated && isVisitorIdLoading) ? (
                <Loader className="bg-foreground/5 size-6 animate-spin cursor-pointer rounded-2xl p-1 duration-300" />
              ) : (
                <SmilePlus className="bg-foreground/5 size-6 cursor-pointer rounded-2xl p-1 duration-300 hover:scale-110" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="bg-background/90 w-fit p-0 backdrop-blur-sm">
            <div className="grid grid-cols-6 divide-x divide-y">
              {pickerReactions.map((reaction) => (
                <div
                  className="flex size-10 cursor-pointer items-center justify-center"
                  key={reaction}
                >
                  <span
                    className="duration-300 hover:scale-120"
                    onClick={() => handleReactionClick(reaction)}
                  >
                    {reaction}
                  </span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
