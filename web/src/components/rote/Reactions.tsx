import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import mainJson from '@/json/main.json';
import { profileAtom } from '@/state/profile';
import { visitorIdAtom } from '@/state/visitorId';
import type { Reaction, Rote, Rotes } from '@/types/main';
import { del, post } from '@/utils/api';
import { useAtom, useAtomValue } from 'jotai';
import { Loader, SmilePlus, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { KeyedMutator } from 'swr';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';

const { preReactions } = mainJson;

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
  const profile = useAtomValue(profileAtom);

  const [open, setOpen] = useState(false);
  const [visitorId, setVisitorId] = useAtom(visitorIdAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisitorIdLoading, setIsVisitorIdLoading] = useState(false);

  const isAuthenticated = !!profile?.id;

  React.useEffect(() => {
    if (!isAuthenticated && !visitorId) {
      setIsVisitorIdLoading(true);
      import('@/utils/deviceFingerprint')
        .then(({ generateVisitorId }) => generateVisitorId().then(setVisitorId))
        .finally(() => setIsVisitorIdLoading(false));
    }
  }, [isAuthenticated, visitorId, setVisitorId]);

  const groupedReactions = rote.reactions.reduce(
    (acc, reaction) => {
      acc[reaction.type] = acc[reaction.type] || [];
      acc[reaction.type].push(reaction);
      return acc;
    },
    {} as Record<string, Reaction[]>
  );

  const handleReactionClick = async (reactionType: string) => {
    setOpen(false);
    setIsLoading(true);

    try {
      const existingReaction = isAuthenticated
        ? rote.reactions.find((r) => r.type === reactionType && r.userid === profile?.id)
        : rote.reactions.find((r) => r.type === reactionType && r.visitorId === visitorId);

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
          const ReactionButton = (
            <div
              className={`flex h-6 ${
                isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
              } items-center gap-2 rounded-full px-2 pr-3 text-xs duration-300 ${
                (
                  isAuthenticated
                    ? rote.reactions.some((r) => r.type === type && r.userid === profile?.id)
                    : rote.reactions.some((r) => r.type === type && r.visitorId === visitorId)
                )
                  ? 'border-theme/30 bg-theme/10 text-theme hover:bg-theme/30 border-[0.5px]'
                  : 'bg-foreground/5 hover:bg-foreground/5'
              }`}
              onClick={() => (isLoading ? undefined : handleReactionClick(type))}
            >
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
                          <Avatar className="border-background ring-foreground/10 size-5 border-2 ring-1">
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          {isLoading || (!isAuthenticated && isVisitorIdLoading) ? (
            <Loader className="bg-foreground/5 size-6 animate-spin cursor-pointer rounded-2xl p-1 duration-300" />
          ) : (
            <SmilePlus className="bg-foreground/5 size-6 cursor-pointer rounded-2xl p-1 duration-300 hover:scale-110" />
          )}
        </PopoverTrigger>
        <PopoverContent side="bottom" className="bg-background/90 w-fit p-0 backdrop-blur-sm">
          <div className="grid grid-cols-6 divide-x divide-y">
            {preReactions.map((reaction) => (
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
    </div>
  );
}
