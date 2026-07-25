import type { AdminHookChannel, AdminHookEvent } from '../../types/config';

export const ADMIN_HOOK_EVENTS: AdminHookEvent[] = ['user.registered', 'note.public.created'];
export const DEFAULT_BARK_SERVER_URL = 'https://api.day.app';
export const REQUEST_TIMEOUT_MS = 5000;

export interface AdminHookActor {
  id?: string;
  username?: string;
  nickname?: string | null;
  role?: string;
  type: 'user' | 'system';
}

export interface AdminHookEnvelope {
  actor: AdminHookActor;
  event: AdminHookEvent;
  note?: {
    author?: {
      id?: string;
      nickname?: string | null;
      username?: string;
    };
    contentPreview: string;
    id: string;
    state: string;
    title?: string | null;
    url?: string;
  };
  occurredAt: string;
  site: {
    defaultLanguage?: string;
    frontendUrl?: string;
    name: string;
  };
  user?: {
    createdAt?: string;
    id: string;
    nickname?: string | null;
    role?: string;
    username: string;
  };
}

export interface AdminHookDeliveryResult {
  channelId: string;
  channelName: string;
  channelType: AdminHookChannel['type'];
  details?: unknown;
  error?: string;
  status: 'success' | 'failed' | 'skipped';
}

export interface AdminHookDeliverySummary {
  event: AdminHookEvent;
  results: AdminHookDeliveryResult[];
  summary: {
    failed: number;
    skipped: number;
    success: number;
  };
  totalChannels: number;
}
