import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { put } from '@/utils/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';
import AdminSettingsPanel from '../settings/AdminSettingsPanel';
import OAuthProviderConfig from './OAuthProviderConfig';
import { normalizeOAuthConfig } from './oauthConfig';

interface OAuthConfigTabProps {
  securityConfig: SystemConfig['security'] | undefined;
  setSecurityConfig: (config: SystemConfig['security'] | undefined) => void;
  isSaving: boolean;
  hasUnsavedChanges?: boolean;
  setIsSaving: (saving: boolean) => void;
  onMutate: () => void;
  onSaved?: (oauth: NonNullable<SystemConfig['security']>['oauth']) => void;
}

// 支持的 OAuth 提供商列表（与后端注册的提供商保持一致）
const SUPPORTED_OAUTH_PROVIDERS = ['github', 'apple'] as const;

export default function OAuthConfigTab({
  securityConfig,
  setSecurityConfig,
  isSaving,
  hasUnsavedChanges = true,
  setIsSaving,
  onMutate,
  onSaved,
}: OAuthConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();
  const [saveError, setSaveError] = useState<string | null>(null);
  const oauth = normalizeOAuthConfig(securityConfig?.oauth);
  const oauthEnabled = oauth.enabled;

  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await put('/admin/settings', {
        group: 'security',
        config: { oauth },
      });
      onSaved?.(oauth);
      toast.success(t('saveSuccess'));
      onMutate();
      // 安全配置变更后，刷新全局配置缓存
      globalMutate('/admin/settings');
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      const message = t('saveFailed', {
        error: t(`security.errors.${errorMessage}`, { defaultValue: errorMessage }),
      });
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminSettingsPanel
      isDirty={hasUnsavedChanges}
      saveError={saveError}
      header={
        <CardHeader className="pb-0">
          <CardTitle>{t('oauth.title')}</CardTitle>
          <CardDescription>{t('oauth.description')}</CardDescription>
        </CardHeader>
      }
      actions={
        <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="w-full">
          {isSaving ? t('saving') : t('save')}
        </Button>
      }
    >
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('oauth.enabled')}</Label>
              <p className="text-muted-foreground text-sm">{t('oauth.enabledDesc')}</p>
            </div>
            <Switch
              checked={oauthEnabled}
              onCheckedChange={(checked) => {
                setSecurityConfig({
                  ...(securityConfig || {}),
                  oauth: { ...oauth, enabled: checked },
                });
              }}
            />
          </div>

          <div className="space-y-6 rounded-lg border p-4">
            {!oauthEnabled && (
              <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                {t('oauth.disabledHint')}
              </div>
            )}
            {SUPPORTED_OAUTH_PROVIDERS.map((provider, index) => (
              <div key={provider} className="space-y-4">
                <OAuthProviderConfig
                  provider={provider}
                  config={oauth.providers?.[provider]}
                  securityConfig={{ ...securityConfig, oauth }}
                  setSecurityConfig={setSecurityConfig}
                />
                {index < SUPPORTED_OAUTH_PROVIDERS.length - 1 && <Divider className="my-4" />}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </AdminSettingsPanel>
  );
}
