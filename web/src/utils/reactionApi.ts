/**
 * 反应相关的 API 工具函数
 */

import { generateVisitorId, getVisitorInfo } from '@/utils/deviceFingerprint';
import { del, post } from './api';

export interface ReactionData {
  type: string; // Emoji 反应类型
  roteid: string;
  userid?: string; // 已登录用户
  visitorId?: string; // 访客 ID
  visitorInfo?: any; // 访客信息
  metadata?: any; // 附加元数据
}

/**
 * 添加反应（支持登录用户和访客）
 */
export async function addReaction(
  roteid: string,
  reactionType: string,
  isAuthenticated: boolean = false,
  metadata?: any
): Promise<any> {
  const reactionData: ReactionData = {
    type: reactionType,
    roteid,
    metadata,
  };

  if (isAuthenticated) {
    // 已登录用户的反应
    return post('/reactions', reactionData);
  } else {
    // 访客反应
    const visitorId = await generateVisitorId();
    const visitorInfo = getVisitorInfo();

    reactionData.visitorId = visitorId;
    reactionData.visitorInfo = visitorInfo;

    return post('/reactions', reactionData);
  }
}

/**
 * 移除反应
 */
export async function removeReaction(
  roteid: string,
  reactionType: string,
  isAuthenticated: boolean = false
): Promise<any> {
  if (isAuthenticated) {
    // 已登录用户移除反应
    return del(`/reactions/${roteid}/${reactionType}`);
  } else {
    // 访客移除反应
    const visitorId = await generateVisitorId();
    return del(`/reactions/${roteid}/${reactionType}?visitorId=${visitorId}`);
  }
}

export default {
  addReaction,
  removeReaction,
};
