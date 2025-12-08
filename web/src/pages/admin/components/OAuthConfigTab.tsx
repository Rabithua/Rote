import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getApiUrl, put } from '@/utils/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';

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
                setSecurityConfig({
                  ...(securityConfig || {}),
                  oauth: {
                    enabled: checked,
                    providers: checked
                      ? {
                          github: {
                            enabled: securityConfig?.oauth?.providers?.github?.enabled ?? false,
                            clientId: securityConfig?.oauth?.providers?.github?.clientId || '',
                            clientSecret:
                              securityConfig?.oauth?.providers?.github?.clientSecret || '',
                            callbackUrl:
                              securityConfig?.oauth?.providers?.github?.callbackUrl ||
                              `${getApiUrl()}/auth/oauth/github/callback`,
                            scopes: securityConfig?.oauth?.providers?.github?.scopes || [
                              'user:email',
                            ],
                          },
                        }
                      : undefined,
                  },
                });
              }}
            />
          </div>

          {showOAuthConfig && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('oauth.github.enabled')}</Label>
                  <p className="text-muted-foreground text-sm">{t('oauth.github.enabledDesc')}</p>
                </div>
                <Switch
                  checked={securityConfig?.oauth?.providers?.github?.enabled ?? false}
                  onCheckedChange={(checked) =>
                    setSecurityConfig({
                      ...(securityConfig || {}),
                      oauth: {
                        ...(securityConfig?.oauth || { enabled: true }),
                        providers: {
                          github: {
                            ...(securityConfig?.oauth?.providers?.github || {}),
                            enabled: checked,
                          },
                        },
                      },
                    })
                  }
                />
              </div>

              {securityConfig?.oauth?.providers?.github?.enabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="github-client-id">{t('oauth.github.clientId')}</Label>
                    <Input
                      id="github-client-id"
                      type="text"
                      value={securityConfig?.oauth?.providers?.github?.clientId || ''}
                      onChange={(e) =>
                        setSecurityConfig({
                          ...(securityConfig || {}),
                          oauth: {
                            ...(securityConfig?.oauth || { enabled: true }),
                            providers: {
                              github: {
                                ...(securityConfig?.oauth?.providers?.github || {}),
                                clientId: e.target.value,
                              },
                            },
                          },
                        })
                      }
                      placeholder="GitHub OAuth App Client ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="github-client-secret">{t('oauth.github.clientSecret')}</Label>
                    <Input
                      id="github-client-secret"
                      type="password"
                      value={securityConfig?.oauth?.providers?.github?.clientSecret || ''}
                      onChange={(e) =>
                        setSecurityConfig({
                          ...(securityConfig || {}),
                          oauth: {
                            ...(securityConfig?.oauth || { enabled: true }),
                            providers: {
                              github: {
                                ...(securityConfig?.oauth?.providers?.github || {}),
                                clientSecret: e.target.value,
                              },
                            },
                          },
                        })
                      }
                      placeholder="GitHub OAuth App Client Secret"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="github-callback-url">{t('oauth.github.callbackUrl')}</Label>
                    <Input
                      id="github-callback-url"
                      type="text"
                      value={securityConfig?.oauth?.providers?.github?.callbackUrl || ''}
                      onChange={(e) =>
                        setSecurityConfig({
                          ...(securityConfig || {}),
                          oauth: {
                            ...(securityConfig?.oauth || { enabled: true }),
                            providers: {
                              github: {
                                ...(securityConfig?.oauth?.providers?.github || {}),
                                callbackUrl: e.target.value,
                              },
                            },
                          },
                        })
                      }
                      placeholder={`${getApiUrl()}/auth/oauth/github/callback`}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t('oauth.github.callbackUrlDesc')}
                    </p>
                  </div>
                </div>
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
