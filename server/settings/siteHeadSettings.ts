import type { SiteConfig } from '../types/config';
import { resolveCustomHeadScriptsUpdate } from '../utils/customHeadScripts';
import { normalizeCustomMetaTags } from './customMetaTags';

export class SiteHeadSettingsError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403
  ) {
    super(message);
  }
}

export function applySiteHeadSettings(
  config: SiteConfig,
  existing: SiteConfig | null,
  isSuperAdmin: boolean
): SiteConfig {
  let customHeadScripts: string | undefined;
  try {
    customHeadScripts = resolveCustomHeadScriptsUpdate(
      existing?.customHeadScripts,
      config.customHeadScripts,
      isSuperAdmin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    throw new SiteHeadSettingsError(
      message,
      message === 'Only super admin can modify custom head scripts' ? 403 : 400
    );
  }

  const currentMetaTags = existing?.customMetaTags;
  const proposedMetaTags = config.customMetaTags;
  if (!isSuperAdmin && proposedMetaTags !== undefined && proposedMetaTags !== currentMetaTags) {
    throw new SiteHeadSettingsError('custom_meta_tags_forbidden', 403);
  }
  const customMetaTags =
    proposedMetaTags === undefined || !isSuperAdmin
      ? currentMetaTags
      : normalizeCustomMetaTags(proposedMetaTags);

  const updated = { ...config, customHeadScripts, customMetaTags };
  if (customHeadScripts === undefined) delete updated.customHeadScripts;
  if (customMetaTags === undefined) delete updated.customMetaTags;
  return updated;
}
