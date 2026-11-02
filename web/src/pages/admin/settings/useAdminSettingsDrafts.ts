import { normalizeOAuthConfig } from '../components/oauthConfig';
import type { SystemConfig } from '../types';
import { useAdminSettingsDraft } from './useAdminSettingsDraft';

export function useAdminSettingsDrafts(configs: SystemConfig | undefined) {
  const site = useAdminSettingsDraft<SystemConfig['site']>(
    configs?.site && {
      description: '',
      icpRecord: '',
      customHeadScripts: '',
      ...configs.site,
      announcement: { enabled: false, content: '', link: '', ...configs.site.announcement },
    }
  );
  const storage = useAdminSettingsDraft<SystemConfig['storage']>(
    configs?.storage || {
      endpoint: '',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      urlPrefix: '',
    }
  );
  const ui = useAdminSettingsDraft<SystemConfig['ui']>({
    allowRegistration: true,
    allowUploadFile: true,
    defaultUserRole: 'user',
    apiRateLimit: 100,
    maxVideoUploadSizeMB: 300,
    ...configs?.ui,
  });
  const { requireVerifiedEmailForExplore, ...securityConfig } = configs?.security || {};
  const security = useAdminSettingsDraft<SystemConfig['security']>({
    ...securityConfig,
    requireCertifiedUserForExplore:
      securityConfig.requireCertifiedUserForExplore ?? requireVerifiedEmailForExplore ?? false,
    oauth: normalizeOAuthConfig(securityConfig.oauth),
  });
  const ai = useAdminSettingsDraft<SystemConfig['ai']>(configs?.ai);
  const drafts = [site, storage, ui, security, ai];

  return {
    site,
    storage,
    ui,
    security,
    ai,
    hasUnsavedChanges: drafts.some((draft) => draft.isDirty),
    discard: () => drafts.forEach((draft) => draft.discard()),
  };
}
