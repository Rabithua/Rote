import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getApiUrl, put } from '@/utils/api';
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

// 支持的 OAuth 提供商列表（与后端注册的提供商保持一致）
const SUPPORTED_OAUTH_PROVIDERS = ['github', 'apple'] as const;

export default function OAuthConfigTab({
  securityConfig,
  setSecurityConfig,
  isSaving,
  setIsSaving,
  onMutate,
}: OAuthConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();
  // 使用 securityConfig?.oauth?.enabled 来控制开关状态，但不影响配置区域的显示
  const oauthEnabled = securityConfig?.oauth?.enabled ?? false;

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
              checked={oauthEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  // 启用 OAuth 时，确保所有支持的提供商都有配置
                  const existingProviders = securityConfig?.oauth?.providers || {};
                  const providers: Record<string, any> = { ...existingProviders };

                  // 确保所有支持的提供商都有配置，缺失的则初始化默认配置
                  for (const provider of SUPPORTED_OAUTH_PROVIDERS) {
                    if (!providers[provider]) {
                      if (provider === 'github') {
                        providers.github = {
                          enabled: false,
                          clientId: '',
                          clientSecret: '',
                          callbackUrl: `${getApiUrl()}/auth/oauth/github/callback`,
                          scopes: ['user:email'],
                        };
                      } else if (provider === 'apple') {
                        providers.apple = {
                          enabled: false,
                          clientId: '',
                          teamId: '',
                          keyId: '',
                          privateKey: '',
                          callbackUrl: `${getApiUrl()}/auth/oauth/apple/callback`,
                          scopes: ['name', 'email'],
                        };
                      }
                    }
                  }

                  setSecurityConfig({
                    ...(securityConfig || {}),
                    oauth: {
                      enabled: true,
                      providers,
                    },
                  });
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

          <div className="space-y-6 rounded-lg border p-4">
            {!oauthEnabled && (
              <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                {t('oauth.disabledHint')}
              </div>
            )}
            {SUPPORTED_OAUTH_PROVIDERS.map((provider, index) => {
              // 获取该提供商的配置，如果不存在则使用默认空配置
              let providerConfig = securityConfig?.oauth?.providers?.[provider];

              // 如果配置不存在，初始化默认配置并更新 state
              if (!providerConfig) {
                const defaultConfig =
                  provider === 'github'
                    ? {
                        enabled: false,
                        clientId: '',
                        clientSecret: '',
                        callbackUrl: `${getApiUrl()}/auth/oauth/github/callback`,
                        scopes: ['user:email'],
                      }
                    : {
                        enabled: false,
                        clientId: '',
                        teamId: '',
                        keyId: '',
                        privateKey: '',
                        callbackUrl: `${getApiUrl()}/auth/oauth/apple/callback`,
                        scopes: ['name', 'email'],
                      };

                // 自动将缺失的提供商配置添加到 state 中
                if (securityConfig) {
                  setSecurityConfig({
                    ...securityConfig,
                    oauth: {
                      ...(securityConfig.oauth || { enabled: true }),
                      providers: {
                        ...(securityConfig.oauth?.providers || {}),
                        [provider]: defaultConfig,
                      },
                    },
                  });
                }
                providerConfig = defaultConfig;
              }

              return (
                <div key={provider} className="space-y-4">
                  <OAuthProviderConfig
                    provider={provider}
                    config={providerConfig}
                    securityConfig={securityConfig}
                    setSecurityConfig={setSecurityConfig}
                  />
                  {index < SUPPORTED_OAUTH_PROVIDERS.length - 1 && <Divider className="my-4" />}
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? t('saving') : t('save')}
        </Button>
      </CardContent>
    </Card>
  );
}
