import type { User } from '../../drizzle/schema';
import type { SiteConfig } from '../../types/config';
import { getGlobalConfig } from '../config';
import type { AdminHookActor, AdminHookEnvelope } from './types';

function getSiteInfo() {
  const siteConfig = getGlobalConfig<SiteConfig>('site');
  return {
    defaultLanguage: siteConfig?.defaultLanguage,
    frontendUrl: siteConfig?.frontendUrl,
    name: siteConfig?.name || 'Rote',
  };
}

function buildUrl(path: string) {
  const site = getSiteInfo();
  if (!site.frontendUrl) return undefined;
  return `${site.frontendUrl.replace(/\/+$/, '')}${path}`;
}

function toActor(user: Partial<User> | null | undefined): AdminHookActor {
  if (!user?.id) return { type: 'system' };
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    type: 'user',
  };
}

function previewText(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export function buildUserRegisteredEnvelope(user: Partial<User>): AdminHookEnvelope {
  return {
    actor: toActor(user),
    event: 'user.registered',
    occurredAt: new Date().toISOString(),
    site: getSiteInfo(),
    user: {
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : undefined,
      id: user.id!,
      nickname: user.nickname,
      role: user.role,
      username: user.username!,
    },
  };
}

export function buildPublicNoteCreatedEnvelope(note: any): AdminHookEnvelope {
  const author = note.author || {};
  const actor = toActor({ ...author, id: note.authorid, role: author.role });
  return {
    actor,
    event: 'note.public.created',
    note: {
      author: {
        id: note.authorid,
        nickname: author.nickname,
        username: author.username,
      },
      contentPreview: previewText(note.content || ''),
      id: note.id,
      state: note.state,
      title: note.title,
      url: buildUrl(`/rote/${note.id}`),
    },
    occurredAt: new Date().toISOString(),
    site: getSiteInfo(),
  };
}
