import { labelForAdminHookEvent } from './localization';
import type { AdminHookEnvelope } from './types';

export function titleForEnvelope(envelope: AdminHookEnvelope) {
  return `${envelope.site.name}: ${labelForAdminHookEvent(
    envelope.event,
    envelope.site.defaultLanguage
  )}`;
}

export function bodyForEnvelope(envelope: AdminHookEnvelope) {
  if (envelope.event === 'user.registered') {
    return [envelope.user?.username, envelope.user?.nickname].filter(Boolean).join(' / ');
  }
  return [
    envelope.note?.author?.username || envelope.actor.username,
    envelope.note?.title,
    envelope.note?.contentPreview,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function urlForEnvelope(envelope: AdminHookEnvelope) {
  if (envelope.note?.url) return envelope.note.url;

  if (
    envelope.event === 'user.registered' &&
    envelope.user?.username &&
    envelope.site.frontendUrl
  ) {
    return `${envelope.site.frontendUrl.replace(/\/+$/, '')}/${encodeURIComponent(
      envelope.user.username
    )}`;
  }

  return envelope.site.frontendUrl;
}
