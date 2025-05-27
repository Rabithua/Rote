import type { ApiGetRotesParams } from '@/types/main';
import { get } from './api';

/**
 * 根据不同的API类型获取笔记列表
 * 替代旧的 apiGetRotes 函数
 */
export async function getRotesV2(props: ApiGetRotesParams) {
  console.log('getRotesV2 called with props:', props);

  const { apiType, params, filter } = props;

  switch (apiType) {
    case 'mine':
      // 获取我的笔记列表
      return get('/notes', params, { filter }).then((res) => res.data);

    case 'public':
      // 获取公开笔记列表
      return get('/notes/public', params).then((res) => res.data);

    case 'userPublic':
      // 获取指定用户的公开笔记列表
      if (!params?.username) {
        throw new Error('Username is required for userPublic API type');
      }
      return get(`/notes/users/${params.username}`, {
        limit: params.limit,
        skip: params.skip,
      }).then((res) => res.data);

    default:
      throw new Error('Unknown API type');
  }
}
