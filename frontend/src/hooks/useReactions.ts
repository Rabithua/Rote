/**
 * 反应状态管理 Hook
 * 处理反应的获取、添加、删除等操作
 */

import type { Reaction } from '@/types/main';
import { generateVisitorId } from '@/utils/deviceFingerprint';
import { addReaction, removeReaction } from '@/utils/reactionApi';
import { useCallback, useEffect, useState } from 'react';

interface UseReactionsOptions {
  roteid: string;
  initialReactions?: Reaction[];
  isAuthenticated: boolean;
  currentUserId?: string;
}

export function useReactions({
  roteid,
  initialReactions = [],
  isAuthenticated,
  currentUserId,
}: UseReactionsOptions) {
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [visitorId, setVisitorId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // 获取访客 ID
  useEffect(() => {
    if (!isAuthenticated) {
      generateVisitorId().then(setVisitorId);
    }
  }, [isAuthenticated]);

  // 更新初始反应数据
  useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  // 获取反应统计
  const getReactionStats = useCallback(() => {
    const stats: Record<string, { count: number; hasReacted: boolean }> = {};

    reactions.forEach((reaction) => {
      const { type } = reaction;
      if (!stats[type]) {
        stats[type] = { count: 0, hasReacted: false };
      }

      stats[type].count += 1;

      // 检查当前用户是否已反应
      if (isAuthenticated && currentUserId && reaction.userid === currentUserId) {
        stats[type].hasReacted = true;
      } else if (!isAuthenticated && visitorId && reaction.visitorId === visitorId) {
        stats[type].hasReacted = true;
      }
    });

    return stats;
  }, [reactions, isAuthenticated, currentUserId, visitorId]);

  // 添加反应
  const handleAddReaction = useCallback(
    async (reactionType: string, metadata?: any) => {
      if (isLoading) return false;

      setIsLoading(true);
      try {
        const result = await addReaction(roteid, reactionType, isAuthenticated, metadata);

        // 乐观更新：立即添加到本地状态
        const currentTime = new Date().toISOString();
        const newReaction: Reaction = {
          id: result.data?.id || `temp_${Date.now()}`,
          type: reactionType,
          roteid,
          userid: isAuthenticated ? currentUserId : undefined,
          visitorId: !isAuthenticated ? visitorId : undefined,
          createdAt: currentTime,
          updatedAt: currentTime,
        };

        setReactions((prev) => [...prev, newReaction]);
        return true;
      } catch (error) {
        // Handle error silently in production, log in development
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Add reaction failed:', error);
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [roteid, isAuthenticated, currentUserId, visitorId, isLoading]
  );

  // 删除反应
  const handleRemoveReaction = useCallback(
    async (reactionType: string) => {
      if (isLoading) return false;

      setIsLoading(true);
      try {
        await removeReaction(roteid, reactionType, isAuthenticated);

        // 乐观更新：立即从本地状态移除
        setReactions((prev) =>
          prev.filter((reaction) => {
            if (reaction.type !== reactionType) return true;

            // 只移除当前用户的反应
            if (isAuthenticated && currentUserId) {
              return reaction.userid !== currentUserId;
            } else if (!isAuthenticated && visitorId) {
              return reaction.visitorId !== visitorId;
            }

            return true;
          })
        );
        return true;
      } catch (error) {
        // Handle error silently in production, log in development
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Remove reaction failed:', error);
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [roteid, isAuthenticated, currentUserId, visitorId, isLoading]
  );

  // 切换反应（添加或删除）
  const handleToggleReaction = useCallback(
    async (reactionType: string, metadata?: any) => {
      const stats = getReactionStats();
      const hasReacted = stats[reactionType]?.hasReacted || false;

      if (hasReacted) {
        return await handleRemoveReaction(reactionType);
      } else {
        return await handleAddReaction(reactionType, metadata);
      }
    },
    [getReactionStats, handleAddReaction, handleRemoveReaction]
  );

  return {
    reactions,
    reactionStats: getReactionStats(),
    isLoading,
    visitorId,
    addReaction: handleAddReaction,
    removeReaction: handleRemoveReaction,
    toggleReaction: handleToggleReaction,
    setReactions,
  };
}

export default useReactions;
