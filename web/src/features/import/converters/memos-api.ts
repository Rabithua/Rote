import type { Memo, MemoSourceData } from './types';
import { importMessage } from '../messages';
import { post } from '@/utils/api';

type ApiResponse<T> = { code: number; message: string; data: T };

export interface MemosApiConfig {
  baseUrl: string;
  token: string;
}

export interface FetchProgress {
  current: number;
  total: number | null;
  message: string;
}

type MemoState = 'NORMAL' | 'ARCHIVED';

/**
 * 从 Memos 实例 API 获取所有 memos 数据
 * @param config API 配置（实例地址和 token）
 * @param onProgress 进度回调
 * @returns MemoSourceData 格式的数据
 */
export async function fetchMemosFromApi(
  config: MemosApiConfig,
  onProgress?: (progress: FetchProgress) => void
): Promise<MemoSourceData> {
  const { baseUrl, token } = config;

  // 规范化 baseUrl，移除末尾斜杠
  const normalizedUrl = baseUrl.replace(/\/+$/, '');

  const memoMap = new Map<string, Memo>();

  onProgress?.({
    current: 0,
    total: null,
    message: importMessage('progress.memosConnecting'),
  });

  for (const state of ['NORMAL', 'ARCHIVED'] satisfies Array<MemoState>) {
    await fetchMemosByState({
      normalizedUrl,
      token,
      state,
      memoMap,
      onProgress,
    });
  }

  const allMemos = [...memoMap.values()];

  onProgress?.({
    current: allMemos.length,
    total: allMemos.length,
    message: importMessage('progress.memosComplete', {
      count: allMemos.length,
    }),
  });

  return {
    memos: allMemos,
    nextPageToken: '',
    sourceAccount: normalizedUrl,
  };
}

async function fetchMemosByState({
  normalizedUrl,
  token,
  state,
  memoMap,
  onProgress,
}: {
  normalizedUrl: string;
  token: string;
  state: MemoState;
  memoMap: Map<string, Memo>;
  onProgress?: (progress: FetchProgress) => void;
}) {
  let pageToken = '';
  let pageCount = 0;
  const pageSize = 50;

  do {
    pageCount++;

    onProgress?.({
      current: memoMap.size,
      total: null,
      message: importMessage('progress.memosPage', {
        state: importMessage(state === 'ARCHIVED' ? 'states.archived' : 'states.normal'),
        page: pageCount,
      }),
    });

    let data: MemoSourceData;
    try {
      const response = await post<ApiResponse<MemoSourceData>>(
        '/imports/memos',
        { baseUrl: normalizedUrl, state, pageToken, pageSize },
        { headers: { 'x-memos-access-token': token } }
      );
      data = response.data;
    } catch (error) {
      const code = (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      if (code === 'memos_unauthorized') throw new Error(importMessage('errors.memosUnauthorized'));
      if (code === 'memos_forbidden') throw new Error(importMessage('errors.memosForbidden'));
      throw new Error(importMessage('errors.memosUnreachable'));
    }

    if (!Array.isArray(data.memos)) {
      throw new Error(importMessage('errors.invalidApiData'));
    }

    data.memos.forEach((memo) => {
      memoMap.set(memo.name, memo);
    });
    pageToken = data.nextPageToken || '';

    onProgress?.({
      current: memoMap.size,
      total: null,
      message: importMessage('progress.memosFetched', {
        count: memoMap.size,
      }),
    });
  } while (pageToken);
}

/**
 * 验证 Memos API 配置是否有效
 */
export async function validateMemosApiConfig(config: MemosApiConfig): Promise<boolean> {
  try {
    await fetchMemosFromApi(config);
    return true;
  } catch {
    return false;
  }
}
