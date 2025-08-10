import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import mainJson from '@/json/main.json';
import { visitorIdAtom } from '@/state/visitorId';
import type { Profile, Reaction, Rote, Rotes } from '@/types/main';
import { del, get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { useAtom } from 'jotai';
import { Loader, SmilePlus } from 'lucide-react';
import React, { useState } from 'react';
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
  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const [open, setOpen] = useState(false);
  const [visitorId, setVisitorId] = useAtom(visitorIdAtom);
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = !!profile?.id;

  React.useEffect(() => {
    if (!isAuthenticated && !visitorId) {
      import('@/utils/deviceFingerprint').then(({ generateVisitorId }) =>
        generateVisitorId().then(setVisitorId)
      );
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
        {Object.entries(groupedReactions).map(([type, reactionGroup]) => (
          <div
            key={type}
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
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          {isLoading ? (
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
