import type { SiteConfig } from '../types/config';
import { getGlobalConfig } from '../utils/config';

export type NoteShareLink = {
  token: string;
  createdAt: Date;
};

export type NoteShareState =
  | { active: false }
  | { active: true; token: string; createdAt: Date; url: string | null };

export function normalizeFrontendOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;

  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getConfiguredFrontendOrigin(): string | null {
  return normalizeFrontendOrigin(getGlobalConfig<SiteConfig>('site')?.frontendUrl);
}

export function presentNoteShare(
  share: NoteShareLink | null,
  frontendOrigin = getConfiguredFrontendOrigin()
): NoteShareState {
  if (!share) return { active: false };
  return {
    active: true,
    token: share.token,
    createdAt: share.createdAt,
    url: frontendOrigin ? `${frontendOrigin}/s/${encodeURIComponent(share.token)}` : null,
  };
}
