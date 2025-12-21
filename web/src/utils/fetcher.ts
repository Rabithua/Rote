import type { ApiGetRotesParams } from '@/types/main';
import axios, { type AxiosResponse } from 'axios';
import { useCallback } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';
import useSWRInfinite, { type SWRInfiniteConfiguration } from 'swr/infinite';

type HttpMethod = 'GET' | 'POST' | 'DELETE';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetcher = async <ApiResponse, TData = unknown>(
  method: HttpMethod,
  url: string,
  data?: TData
): Promise<ApiResponse> => {
  try {
    const response: AxiosResponse<ApiResponse> = await api.request({
      method,
      url,
      data: method !== 'GET' ? data : undefined,
      params: method === 'GET' ? data : undefined,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Failed to fetch data');
    }
    throw error;
  }
};

export const swrMutationFetcher = async <TResponse, TData = unknown>(
  url: string,
  { arg }: { arg: { method: HttpMethod; data?: TData; optimisticData?: TResponse } }
): Promise<TResponse> => {
  const { method, data } = arg;
  return fetcher<TResponse, TData>(method, url, data);
};

interface APIGetProps {
  [key: string]: unknown;
}

export function useAPIGet<TData>(
  props: APIGetProps | string | null,
  fetcher: () => Promise<TData>,
  options?: SWRConfiguration<TData>
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<TData>(props, fetcher, options);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

export function useAPIInfinite<TData = unknown>(
  getKey: (_pageIndex: number, _previousPageData: TData | null) => ApiGetRotesParams | null,
  fetcher: (_data: ApiGetRotesParams) => Promise<TData>,
  options?: SWRInfiniteConfiguration
) {
  const { data, size, setSize, isLoading, isValidating, mutate, error } = useSWRInfinite(
    getKey,
    fetcher,
    options
  );

  const loadMore = useCallback(() => {
    setSize((prevSize) => prevSize + 1);
  }, [setSize]);

  return {
    data,
    size,
    setSize,
    isValidating,
    isLoading,
    mutate,
    loadMore,
    error,
  };
}
