import { get, getApiPoint } from '@/utils/api';
import useSWR from 'swr';
import type { ResourceState } from './types';

export const RESOURCE_STATE_KEY = '/resources/me';

export function isOfficialApiOrigin() {
  try {
    return new URL(getApiPoint()).origin === 'https://api.rote.ink';
  } catch {
    return false;
  }
}

export function useResourceState(enabled = true) {
  return useSWR<ResourceState>(enabled ? RESOURCE_STATE_KEY : null, async () => {
    const response = await get(RESOURCE_STATE_KEY);
    return response.data as ResourceState;
  });
}
