import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { put } from '@/utils/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';
import AdminSettingsPanel from '../settings/AdminSettingsPanel';

const CUSTOM_HEAD_SCRIPTS_MAX_BYTES = 64 * 1024;
const CUSTOM_META_TAGS_MAX_BYTES = 8 * 1024;

interface SiteConfigTabProps {
  siteConfig: SystemConfig['site'] | undefined;
  setSiteConfig: (config: SystemConfig['site'] | undefined) => void;
  isSaving: boolean;
  hasUnsavedChanges?: boolean;
  setIsSaving: (saving: boolean) => void;
  onMutate: () => void;
  onSaved?: (config: SystemConfig['site']) => void;
  isSuperAdmin: boolean;
}

export default function SiteConfigTab({
  siteConfig,
  setSiteConfig,
  isSaving,
  hasUnsavedChanges = true,
  setIsSaving,
  onMutate,
  onSaved,
  isSuperAdmin,
}: SiteConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();
  const [saveError, setSaveError] = useState<string | null>(null);
  const metaTagsValue = siteConfig?.customMetaTags ?? '';
  const metaTagsBytes = new TextEncoder().encode(metaTagsValue).byteLength;

  const handleSave = async () => {
    setSaveError(null);
    if (!siteConfig || !siteConfig.name || !siteConfig.frontendUrl) {
      const message = t('saveFailed', { error: 'Site name and frontend URL are required' });
      setSaveError(message);
      toast.error(message);
      return;
    }
    if (isSuperAdmin && metaTagsBytes > CUSTOM_META_TAGS_MAX_BYTES) {
      toast.error(t('site.customMetaTags.tooLarge'));
      return;
    }
    if (
      new TextEncoder().encode(siteConfig.customHeadScripts || '').byteLength >
      CUSTOM_HEAD_SCRIPTS_MAX_BYTES
    ) {
      const message = t('site.customHeadScripts.tooLarge');
      setSaveError(message);
      toast.error(message);
      return;
    }
    setIsSaving(true);
    try {
      const { customMetaTags = '', ...siteSettings } = siteConfig;
      await put('/admin/settings', {
        group: 'site',
        config: isSuperAdmin ? { ...siteSettings, customMetaTags } : siteSettings,
      });
      onSaved?.(siteConfig);
      toast.success(t('saveSuccess'));
      onMutate();
      // 更新所有使用 site-status 的组件
      globalMutate('site-status');
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      if (apiMessage === 'invalid_custom_meta_tags') {
        toast.error(t('site.customMetaTags.invalid'));
        return;
      }
      if (apiMessage === 'custom_meta_tags_forbidden') {
        toast.error(t('site.customMetaTags.forbidden'));
        return;
      }
      // 优先使用后端返回的错误消息
      const errorMessage =
        apiMessage || error?.message || error?.response?.data?.error || 'Unknown error';
      const message = t('saveFailed', { error: errorMessage });
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
          <CardTitle>{t('site.title')}</CardTitle>
          <CardDescription>{t('site.description')}</CardDescription>
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
              <Label className="text-base">{t('site.announcement.title')}</Label>
              <p className="text-muted-foreground text-sm">{t('site.announcement.description')}</p>
            </div>
            <Switch
              checked={siteConfig?.announcement?.enabled || false}
              onCheckedChange={(checked: boolean) =>
                setSiteConfig({
                  ...(siteConfig || {}),
                  name: siteConfig?.name || '',
                  frontendUrl: siteConfig?.frontendUrl || '',
                  announcement: {
                    enabled: checked,
                    content: siteConfig?.announcement?.content || '',
                    link: siteConfig?.announcement?.link || '',
                  },
                })
              }
            />
          </div>

          {siteConfig?.announcement?.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="announcementContent">{t('site.announcement.content')}</Label>
                <Textarea
                  id="announcementContent"
                  value={siteConfig?.announcement?.content || ''}
                  onChange={(e) =>
                    setSiteConfig({
                      ...(siteConfig || {}),
                      name: siteConfig?.name || '',
                      frontendUrl: siteConfig?.frontendUrl || '',
                      announcement: {
                        ...(siteConfig?.announcement || { enabled: true, content: '', link: '' }),
                        content: e.target.value,
                      },
                    })
                  }
                  placeholder={t('site.announcement.contentPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="announcementLink">{t('site.announcement.link')}</Label>
                <Input
                  id="announcementLink"
                  value={siteConfig?.announcement?.link || ''}
                  onChange={(e) =>
                    setSiteConfig({
                      ...(siteConfig || {}),
                      name: siteConfig?.name || '',
                      frontendUrl: siteConfig?.frontendUrl || '',
                      announcement: {
                        ...(siteConfig?.announcement || { enabled: true, content: '', link: '' }),
                        link: e.target.value,
                      },
                    })
                  }
                  placeholder="https://example.com"
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="siteName">{t('site.name')}</Label>
          <Input
            id="siteName"
            value={siteConfig?.name || ''}
            onChange={(e) =>
              setSiteConfig({
                ...(siteConfig || {}),
                name: e.target.value,
                frontendUrl: siteConfig?.frontendUrl || '',
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="frontendUrl">{t('site.frontendUrl')}</Label>
          <Input
            id="frontendUrl"
            value={siteConfig?.frontendUrl || ''}
            onChange={(e) =>
              setSiteConfig({
                ...(siteConfig || {}),
                name: siteConfig?.name || '',
                frontendUrl: e.target.value,
              })
            }
            placeholder="https://your-domain.com"
          />
          <p className="text-muted-foreground text-xs">{t('site.frontendUrlDescription')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="siteDescription">{t('site.descriptionLabel')}</Label>
          <Textarea
            id="siteDescription"
            value={siteConfig?.description || ''}
            onChange={(e) =>
              setSiteConfig({
                ...(siteConfig || {}),
                name: siteConfig?.name || '',
                frontendUrl: siteConfig?.frontendUrl || '',
                description: e.target.value,
              })
            }
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="icpRecord">{t('site.icpRecord')}</Label>
          <Input
            id="icpRecord"
            value={siteConfig?.icpRecord || ''}
            onChange={(e) =>
              setSiteConfig({
                ...(siteConfig || {}),
                name: siteConfig?.name || '',
                frontendUrl: siteConfig?.frontendUrl || '',
                description: siteConfig?.description || '',
                icpRecord: e.target.value,
              })
            }
            placeholder="京ICP备12345678号"
          />
          <p className="text-muted-foreground text-xs">{t('site.icpRecordDescription')}</p>
        </div>

        {isSuperAdmin && (
          <div className="space-y-2">
            <Label htmlFor="customMetaTags">{t('site.customMetaTags.title')}</Label>
            <Textarea
              id="customMetaTags"
              aria-describedby="customMetaTagsDescription"
              value={metaTagsValue}
              onChange={(e) =>
                setSiteConfig({
                  ...(siteConfig || {}),
                  name: siteConfig?.name || '',
                  frontendUrl: siteConfig?.frontendUrl || '',
                  customMetaTags: e.target.value,
                })
              }
              placeholder={t('site.customMetaTags.placeholder')}
              minRows={3}
              className="font-mono text-xs"
              spellCheck={false}
            />
            <div className="text-muted-foreground flex justify-between gap-4 text-xs">
              <span id="customMetaTagsDescription">{t('site.customMetaTags.description')}</span>
              <span className="shrink-0">
                {metaTagsBytes} / {CUSTOM_META_TAGS_MAX_BYTES}
              </span>
            </div>
          </div>
        )}

        {isSuperAdmin && (
          <div className="space-y-2">
            <Label htmlFor="customHeadScripts">{t('site.customHeadScripts.title')}</Label>
            <p className="text-destructive text-sm">{t('site.customHeadScripts.warning')}</p>
            <Textarea
              id="customHeadScripts"
              value={siteConfig?.customHeadScripts || ''}
              onChange={(e) =>
                setSiteConfig({
                  ...(siteConfig || {}),
                  name: siteConfig?.name || '',
                  frontendUrl: siteConfig?.frontendUrl || '',
                  customHeadScripts: e.target.value,
                })
              }
              placeholder={t('site.customHeadScripts.placeholder')}
              rows={9}
              className="font-mono text-xs"
              spellCheck={false}
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{t('site.customHeadScripts.description')}</span>
              <span>
                {new TextEncoder().encode(siteConfig?.customHeadScripts || '').byteLength} /{' '}
                {CUSTOM_HEAD_SCRIPTS_MAX_BYTES}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </AdminSettingsPanel>
  );
}
