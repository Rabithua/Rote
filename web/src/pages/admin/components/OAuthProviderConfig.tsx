import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getApiUrl } from '@/utils/api';
import { useTranslation } from 'react-i18next';
import type { SystemConfig } from '../types';

interface OAuthProviderConfigProps {
  provider: string;
  config: any;
  securityConfig: SystemConfig['security'] | undefined;
  setSecurityConfig: (config: SystemConfig['security'] | undefined) => void;
}

export default function OAuthProviderConfig({
  provider,
  config,
  securityConfig,
  setSecurityConfig,
}: OAuthProviderConfigProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });

  const updateProviderConfig = (updates: any) => {
    setSecurityConfig({
      ...(securityConfig || {}),
      oauth: {
        ...(securityConfig?.oauth || { enabled: true }),
        providers: {
          ...(securityConfig?.oauth?.providers || {}),
          [provider]: {
            ...(securityConfig?.oauth?.providers?.[provider] || {}),
            ...updates,
          },
        },
      },
    });
  };

  const updateField = (field: string, value: any) => {
    updateProviderConfig({
      [field]: value,
    });
  };

  // GitHub 配置表单
  if (provider === 'github') {
    return (
      <>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t('oauth.github.enabled')}</Label>
            <p className="text-muted-foreground text-sm">{t('oauth.github.enabledDesc')}</p>
          </div>
          <Switch
            checked={config?.enabled ?? false}
            onCheckedChange={(checked) => updateField('enabled', checked)}
          />
        </div>

        {config?.enabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${provider}-client-id`}>{t('oauth.github.clientId')}</Label>
              <Input
                id={`${provider}-client-id`}
                type="text"
                value={config?.clientId || ''}
                onChange={(e) => updateField('clientId', e.target.value)}
                placeholder="GitHub OAuth App Client ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-client-secret`}>{t('oauth.github.clientSecret')}</Label>
              <Input
                id={`${provider}-client-secret`}
                type="password"
                value={config?.clientSecret || ''}
                onChange={(e) => updateField('clientSecret', e.target.value)}
                placeholder="GitHub OAuth App Client Secret"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-callback-url`}>{t('oauth.github.callbackUrl')}</Label>
              <Input
                id={`${provider}-callback-url`}
                type="text"
                value={config?.callbackUrl || ''}
                onChange={(e) => updateField('callbackUrl', e.target.value)}
                placeholder={`${getApiUrl()}/auth/oauth/${provider}/callback`}
              />
              <p className="text-muted-foreground text-xs">{t('oauth.github.callbackUrlDesc')}</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Apple 配置表单
  if (provider === 'apple') {
    return (
      <>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t('oauth.apple.enabled')}</Label>
            <p className="text-muted-foreground text-sm">{t('oauth.apple.enabledDesc')}</p>
          </div>
          <Switch
            checked={config?.enabled ?? false}
            onCheckedChange={(checked) => updateField('enabled', checked)}
          />
        </div>

        {config?.enabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${provider}-client-id`}>{t('oauth.apple.clientId')}</Label>
              <Input
                id={`${provider}-client-id`}
                type="text"
                value={config?.clientId || ''}
                onChange={(e) => updateField('clientId', e.target.value)}
                placeholder={t('oauth.apple.clientIdPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-team-id`}>{t('oauth.apple.teamId')}</Label>
              <Input
                id={`${provider}-team-id`}
                type="text"
                value={config?.teamId || ''}
                onChange={(e) => updateField('teamId', e.target.value)}
                placeholder={t('oauth.apple.teamIdPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-key-id`}>{t('oauth.apple.keyId')}</Label>
              <Input
                id={`${provider}-key-id`}
                type="text"
                value={config?.keyId || ''}
                onChange={(e) => updateField('keyId', e.target.value)}
                placeholder={t('oauth.apple.keyIdPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-private-key`}>{t('oauth.apple.privateKey')}</Label>
              <Textarea
                id={`${provider}-private-key`}
                value={config?.privateKey || ''}
                onChange={(e) => updateField('privateKey', e.target.value)}
                placeholder={t('oauth.apple.privateKeyPlaceholder')}
                rows={6}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-callback-url`}>{t('oauth.apple.callbackUrl')}</Label>
              <Input
                id={`${provider}-callback-url`}
                type="text"
                value={config?.callbackUrl || ''}
                onChange={(e) => updateField('callbackUrl', e.target.value)}
                placeholder={`${getApiUrl()}/auth/oauth/${provider}/callback`}
              />
              <p className="text-muted-foreground text-xs">{t('oauth.apple.callbackUrlDesc')}</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // 其他提供商（通用表单，未来扩展）
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>{t('oauth.providers.enabled', { provider })}</Label>
          <p className="text-muted-foreground text-sm">
            {t('oauth.providers.enabledDesc', { provider })}
          </p>
        </div>
        <Switch
          checked={config?.enabled ?? false}
          onCheckedChange={(checked) => updateField('enabled', checked)}
        />
      </div>

      {config?.enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${provider}-client-id`}>Client ID</Label>
            <Input
              id={`${provider}-client-id`}
              type="text"
              value={config?.clientId || ''}
              onChange={(e) => updateField('clientId', e.target.value)}
              placeholder={`${provider} Client ID`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${provider}-callback-url`}>Callback URL</Label>
            <Input
              id={`${provider}-callback-url`}
              type="text"
              value={config?.callbackUrl || ''}
              onChange={(e) => updateField('callbackUrl', e.target.value)}
              placeholder={`${getApiUrl()}/auth/oauth/${provider}/callback`}
            />
          </div>
        </div>
      )}
    </>
  );
}
