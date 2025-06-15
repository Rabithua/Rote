import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import mainJson from '@/json/main.json';
import type { Profile, Reaction, Rote, Rotes } from '@/types/main';
import { del, get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
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

// 访客ID缓存
let visitorIdCache: string | null = null;

// 访客ID管理工具
const getVisitorId = async (): Promise<string | null> => {
  if (visitorIdCache) return visitorIdCache;

  try {
    const { generateVisitorId } = await import('@/utils/deviceFingerprint');
    visitorIdCache = await generateVisitorId();
    return visitorIdCache;
  } catch {
    return null;
  }
};

export function ReactionsPart({ rote, mutate, mutateSingle }: ReactionsPartProps) {
  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const [open, setOpen] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = !!profile?.id;

  // 初始化访客ID
  React.useEffect(() => {
    if (!isAuthenticated) {
      getVisitorId().then(setVisitorId);
    }
  }, [isAuthenticated]);

  /**
   * 查找用户的现有反应
   */
  const findUserReaction = React.useCallback(
    (reactionType: string): Reaction | undefined => {
      if (isAuthenticated) {
        return rote.reactions.find((r) => r.type === reactionType && r.userid === profile?.id);
      }

      if (visitorId) {
        return rote.reactions.find((r) => r.type === reactionType && r.visitorId === visitorId);
      }

      return undefined;
    },
    [rote.reactions, isAuthenticated, profile?.id, visitorId]
  );

  /**
   * 更新本地反应状态
   */
  const updateLocalReactions = React.useCallback(
    (existingReaction?: Reaction, newReaction?: Reaction) => {
      const updateReactions = (reactions: Reaction[]) => {
        if (existingReaction) {
          return reactions.filter((item) => item.id !== existingReaction.id);
        }
        if (newReaction) {
          return [...reactions, newReaction];
        }
        return reactions;
      };

      if (mutate) {
        mutate(
          (currentData) =>
            currentData?.map((page) =>
              Array.isArray(page)
                ? page.map((r) =>
                    r.id === rote.id ? { ...r, reactions: updateReactions(r.reactions) } : r
                  )
                : page
            ) as Rotes,
          { revalidate: false }
        );
      }

      if (mutateSingle) {
        mutateSingle(
          (currentRote) =>
            currentRote && {
              ...currentRote,
              reactions: updateReactions(currentRote.reactions),
            },
          { revalidate: false }
        );
      }
    },
    [mutate, mutateSingle, rote.id]
  );

  /**
   * 处理反应点击
   */
  const handleReaction = React.useCallback(
    async (reactionType: string) => {
      setIsLoading(true);

      try {
        const existingReaction = findUserReaction(reactionType);

        if (existingReaction) {
          // 删除现有反应
          if (isAuthenticated) {
            await del(`/reactions/${rote.id}/${reactionType}`);
          } else {
            const currentVisitorId = await getVisitorId();
            if (currentVisitorId) {
              await del(
                `/reactions/${rote.id}/${reactionType}?visitorId=${encodeURIComponent(currentVisitorId)}`
              );
            }
          }

          updateLocalReactions(existingReaction);
        } else {
          // 添加新反应
          const reactionData: ReactionData = {
            type: reactionType,
            roteid: rote.id,
            metadata: { source: 'web' },
          };

          if (!isAuthenticated) {
            const currentVisitorId = await getVisitorId();
            if (currentVisitorId) {
              const { getVisitorInfo } = await import('@/utils/deviceFingerprint');
              reactionData.visitorId = currentVisitorId;
              reactionData.visitorInfo = getVisitorInfo();
            }
          }

          const response = await post('/reactions', reactionData);
          updateLocalReactions(undefined, response.data);
        }
      } catch {
        // 静默处理错误
      } finally {
        setIsLoading(false);
      }
    },
    [rote.id, isAuthenticated, findUserReaction, updateLocalReactions]
  );

  /**
   * 处理反应选择器点击
   */
  const handleReactionClick = React.useCallback(
    (reactionType: string) => {
      setOpen(false);
      handleReaction(reactionType);
    },
    [handleReaction]
  );

  // 按类型分组反应
  const groupedReactions = React.useMemo(
    () =>
      rote.reactions.reduce(
        (acc, reaction) => {
          if (!acc[reaction.type]) {
            acc[reaction.type] = [];
          }
          acc[reaction.type].push(reaction);
          return acc;
        },
        {} as Record<string, Reaction[]>
      ),
    [rote.reactions]
  );

  // 检查用户是否对某个反应做出过响应
  const hasUserReacted = React.useCallback(
    (reactionType: string): boolean => !!findUserReaction(reactionType),
    [findUserReaction]
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(groupedReactions).map(([type, reactionGroup]) => {
          const userReacted = hasUserReacted(type);

          return (
            <div
              key={type}
              className={`flex h-6 cursor-pointer items-center gap-2 rounded-full px-2 pr-3 text-xs duration-300 ${
                userReacted
                  ? 'bg-theme/10 text-theme border-theme/30 hover:bg-theme/30 border-[0.5px]'
                  : 'bg-foreground/5 hover:bg-foreground/5'
              }`}
              onClick={() => handleReactionClick(type)}
            >
              <span>{type}</span>
              <SlidingNumber className="text-xs" number={reactionGroup.length} />
            </div>
          );
        })}
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
