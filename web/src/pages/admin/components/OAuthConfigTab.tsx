import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getApiUrl, put } from '@/utils/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';
import OAuthProviderConfig from './OAuthProviderConfig';

interface OAuthConfigTabProps {
  securityConfig: SystemConfig['security'] | undefined;
  setSecurityConfig: (config: SystemConfig['security'] | undefined) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  onMutate: () => void;
}

export default function OAuthConfigTab({
  securityConfig,
  setSecurityConfig,
  isSaving,
  setIsSaving,
  onMutate,
}: OAuthConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();
  const [showOAuthConfig, setShowOAuthConfig] = useState(securityConfig?.oauth?.enabled ?? false);

  const handleSave = async () => {
    if (!securityConfig) {
      setSecurityConfig({
        requireVerifiedEmailForExplore: false,
        oauth: {
          enabled: false,
          providers: {},
        },
      });
    }

    setIsSaving(true);
    try {
      await put('/admin/settings', {
        group: 'security',
        config: securityConfig || {
          requireVerifiedEmailForExplore: false,
          oauth: {
            enabled: false,
            providers: {},
          },
        },
      });
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
      toast.error(t('saveFailed', { error: errorMessage }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-none border-none shadow-none">
      <CardHeader className="pb-0">
        <CardTitle>{t('oauth.title')}</CardTitle>
        <CardDescription>{t('oauth.description')}</CardDescription>
      </CardHeader>
      <Divider />
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('oauth.enabled')}</Label>
              <p className="text-muted-foreground text-sm">{t('oauth.enabledDesc')}</p>
            </div>
            <Switch
              checked={showOAuthConfig}
              onCheckedChange={(checked) => {
                setShowOAuthConfig(checked);
                if (checked) {
                  // 启用 OAuth 时，保留现有配置或初始化默认配置
                  const existingProviders = securityConfig?.oauth?.providers || {};
                  // 如果没有任何提供商配置，初始化 GitHub 和 Apple 的默认配置
                  if (Object.keys(existingProviders).length === 0) {
                    setSecurityConfig({
                      ...(securityConfig || {}),
                      oauth: {
                        enabled: true,
                        providers: {
                          github: {
                            enabled: false,
                            clientId: '',
                            clientSecret: '',
                            callbackUrl: `${getApiUrl()}/auth/oauth/github/callback`,
                            scopes: ['user:email'],
                          },
                          apple: {
                            enabled: false,
                            clientId: '',
                            teamId: '',
                            keyId: '',
                            privateKey: '',
                            callbackUrl: `${getApiUrl()}/auth/oauth/apple/callback`,
                            scopes: ['name', 'email'],
                          },
                        },
                      },
                    });
                  } else {
                    setSecurityConfig({
                      ...(securityConfig || {}),
                      oauth: {
                        enabled: true,
                        providers: existingProviders,
                      },
                    });
                  }
                } else {
                  // 禁用 OAuth 时，保留配置但设置 enabled 为 false
                  setSecurityConfig({
                    ...(securityConfig || {}),
                    oauth: {
                      enabled: false,
                      providers: securityConfig?.oauth?.providers,
                    },
                  });
                }
              }}
            />
          </div>

          {showOAuthConfig && (
            <div className="space-y-6 rounded-lg border p-4">
              {securityConfig?.oauth?.providers &&
                Object.entries(securityConfig.oauth.providers).map(
                  ([provider, providerConfig], index, array) => (
                    <div key={provider} className="space-y-4">
                      <OAuthProviderConfig
                        provider={provider}
                        config={providerConfig}
                        securityConfig={securityConfig}
                        setSecurityConfig={setSecurityConfig}
                      />
                      {index < array.length - 1 && <Divider className="my-4" />}
                    </div>
                  )
                )}
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? t('saving') : t('save')}
        </Button>
      </CardContent>
    </Card>
  );
}
