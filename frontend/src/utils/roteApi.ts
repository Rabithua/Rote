import type { ApiGetRotesParams } from '@/types/main';
import { get } from './api';

/**
 * 统一的笔记获取和搜索函数
 * 支持获取和搜索我的笔记、公开笔记和指定用户的公开笔记
 * 当提供 keyword 时进行搜索，否则获取所有笔记
 */
export async function getRotesV2(props: ApiGetRotesParams) {
  const { apiType, params } = props;
  const keyword = params?.keyword;

  // 根据是否有关键词决定使用搜索还是普通获取接口
  const useSearchAPI = !!keyword;

  switch (apiType) {
    case 'mine':
      if (useSearchAPI) {
        return get('/notes/search', params).then((res) => res.data);
      } else {
        return get('/notes', params).then((res) => res.data);
      }

    case 'public':
      if (useSearchAPI) {
        return get('/notes/search/public', params).then((res) => res.data);
      } else {
        return get('/notes/public', params).then((res) => res.data);
      }

    case 'userPublic': {
      if (!params?.username) {
        throw new Error('Username is required for userPublic API type');
      }

      if (useSearchAPI) {
        const searchParams: Record<string, any> = {
          limit: params.limit,
          skip: params.skip,
          keyword,
          archived: params.archived,
        };
        if (params.tag) {
          searchParams.tag = params.tag;
        }
        return get(`/notes/search/users/${params.username}`, searchParams).then((res) => res.data);
      } else {
        return get(`/notes/users/${params.username}`, {
          limit: params.limit,
          skip: params.skip,
          archived: params.archived,
          tag: params.tag,
        }).then((res) => res.data);
      }
    }

    default:
      throw new Error('Unknown API type');
  }
}

/**
 * @deprecated 使用 getRotesV2 替代，该函数现在是 getRotesV2 的别名
 * 为了向后兼容性而保留
 */
export const searchRotesV2 = getRotesV2;
