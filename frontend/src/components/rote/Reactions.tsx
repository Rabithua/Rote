import mainJson from '@/json/main.json';
import type { Profile, Reaction, Rote, Rotes } from '@/types/main';
import { del, get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { SmilePlus } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { KeyedMutator } from 'swr';

const { preReactions } = mainJson;

export function ReactionsPart({
  rote,
  mutate,
  mutateSingle,
}: {
  rote: Rote;
  mutate?: SWRInfiniteKeyedMutator<Rotes>;
  mutateSingle?: KeyedMutator<Rote>;
}) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteItem',
  });

  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const [open, setOpen] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);

  /**
   * 反应处理相关的辅助函数集合
   */
  const reactionHelpers = {
    // 获取现有反应
    async findExistingReaction(reaction: string, isAuthenticated: boolean) {
      if (isAuthenticated) {
        return rote.reactions.find((r) => r.type === reaction && r.userid === profile?.id);
      }

      try {
        const { generateVisitorId } = await import('@/utils/deviceFingerprint');
        const visitorId = await generateVisitorId();
        return rote.reactions.find((r) => r.type === reaction && r.visitorId === visitorId);
      } catch {
        return null;
      }
    },

    // 删除反应
    async removeReaction(reaction: string, isAuthenticated: boolean) {
      if (isAuthenticated) {
        return await del(`/reactions/${rote.id}/${reaction}`);
      }

      const { generateVisitorId } = await import('@/utils/deviceFingerprint');
      const visitorId = await generateVisitorId();
      return await del(
        `/reactions/${rote.id}/${reaction}?visitorId=${encodeURIComponent(visitorId)}`
      );
    },

    // 添加反应
    async addReaction(reaction: string, isAuthenticated: boolean) {
      const reactionData: any = {
        type: reaction,
        roteid: rote.id,
        metadata: { source: 'web' },
      };

      if (!isAuthenticated) {
        const { generateVisitorId, getVisitorInfo } = await import('@/utils/deviceFingerprint');
        reactionData.visitorId = await generateVisitorId();
        reactionData.visitorInfo = getVisitorInfo();
      }

      return await post('/reactions', reactionData);
    },

    // 更新本地状态
    updateLocalReactions(existingReaction: any, newReaction?: any) {
      if (mutate) {
        mutate(
          (currentData) =>
            currentData?.map((page) =>
              Array.isArray(page)
                ? page.map((r) =>
                    r.id === rote.id
                      ? {
                          ...r,
                          reactions: existingReaction
                            ? r.reactions.filter((item: any) => item.id !== existingReaction.id)
                            : [...r.reactions, newReaction],
                        }
                      : r
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
              reactions: existingReaction
                ? currentRote.reactions.filter((item) => item.id !== existingReaction.id)
                : [...currentRote.reactions, newReaction],
            },
          { revalidate: false }
        );
      }
    },
  };

  /**
   * 处理反应的主要函数
   * 支持已登录用户和匿名访客
   */
  async function onReaction(reaction: string) {
    const toastId = toast.loading(t('messages.sending'));
    const isAuthenticated = !!profile?.id;

    try {
      const existingReaction = await reactionHelpers.findExistingReaction(
        reaction,
        isAuthenticated
      );

      if (existingReaction) {
        // 取消现有反应
        await reactionHelpers.removeReaction(reaction, isAuthenticated);
        toast.success(t('messages.reactCancelSuccess'), { id: toastId });
        reactionHelpers.updateLocalReactions(existingReaction);
      } else {
        // 添加新反应
        const res = await reactionHelpers.addReaction(reaction, isAuthenticated);
        toast.success(t('messages.reactSuccess'), { id: toastId });
        reactionHelpers.updateLocalReactions(null, res.data);
      }
    } catch {
      toast.error(t('messages.reactFailed'), { id: toastId });
    }
  }

  // 异步获取访客ID（仅针对匿名用户）
  React.useEffect(() => {
    if (!profile?.id) {
      import('@/utils/deviceFingerprint').then(({ generateVisitorId }) => {
        generateVisitorId()
          .then(setVisitorId)
          .catch(() => setVisitorId(null));
      });
    }
  }, [profile?.id]);

  function onReactionClick(reaction: string) {
    setOpen(false);
    onReaction(reaction);
  }

  // 按 type 分组 reactions
  const groupedReactions = rote.reactions.reduce(
    (acc, reaction) => {
      const type = reaction.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(reaction);
      return acc;
    },
    {} as Record<string, Reaction[]>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(groupedReactions).map(([type, reactionGroup]) => {
          // 检查用户是否已经对该反应做出过响应
          const hasUserReacted = profile?.id
            ? reactionGroup.some((reaction) => reaction.userid === profile.id)
            : visitorId
              ? reactionGroup.some((reaction) => reaction.visitorId === visitorId)
              : false;

          return (
            <div
              key={type}
              className={`flex h-6 cursor-pointer items-center gap-2 rounded-full px-2 pr-3 text-xs duration-300 ${
                hasUserReacted
                  ? 'bg-theme/10 text-theme border-theme/30 hover:bg-theme/30 border-[0.5px]'
                  : 'bg-foreground/5 hover:bg-foreground/10'
              }`}
              onClick={() => onReactionClick(type)}
            >
              <span>{type}</span>
              <span className="text-xs">{reactionGroup.length}</span>
            </div>
          );
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <SmilePlus className="bg-foreground/5 size-6 cursor-pointer rounded-2xl p-1 duration-300 hover:scale-110" />
        </PopoverTrigger>
        <PopoverContent side="bottom" className="bg-background/90 w-fit p-0 backdrop-blur-sm">
          <div className="flex flex-wrap divide-x">
            {preReactions.map((reaction) => (
              <div
                className="flex size-10 cursor-pointer items-center justify-center"
                key={reaction}
              >
                <span
                  className="duration-300 hover:scale-120"
                  onClick={() => onReactionClick(reaction)}
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
