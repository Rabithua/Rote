import type { Memo, MemoSourceData } from './types';
import { importMessage } from '../messages';

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

    const url = new URL(`${normalizedUrl}/api/v1/memos`);
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('state', state);
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    onProgress?.({
      current: memoMap.size,
      total: null,
      message: importMessage('progress.memosPage', {
        state: importMessage(state === 'ARCHIVED' ? 'states.archived' : 'states.normal'),
        page: pageCount,
      }),
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(importMessage('errors.memosUnauthorized'));
      }
      if (response.status === 403) {
        throw new Error(importMessage('errors.memosForbidden'));
      }
      if (response.status === 404) {
        throw new Error(importMessage('errors.memosNotFound'));
      }
      throw new Error(
        importMessage('errors.requestFailed', {
          status: response.status,
          message: response.statusText,
        })
      );
    }

    const data = (await response.json()) as MemoSourceData;

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
  const { baseUrl, token } = config;
  const normalizedUrl = baseUrl.replace(/\/+$/, '');

  try {
    const response = await fetch(`${normalizedUrl}/api/v1/memos?pageSize=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
