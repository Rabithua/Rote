import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { put } from '@/utils/api';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';

interface SiteConfigTabProps {
  siteConfig: SystemConfig['site'] | undefined;
  setSiteConfig: (config: SystemConfig['site'] | undefined) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  onMutate: () => void;
}

export default function SiteConfigTab({
  siteConfig,
  setSiteConfig,
  isSaving,
  setIsSaving,
  onMutate,
}: SiteConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();

  const handleSave = async () => {
    if (!siteConfig || !siteConfig.name || !siteConfig.frontendUrl) {
      toast.error(t('saveFailed', { error: 'Site name and frontend URL are required' }));
      return;
    }
    setIsSaving(true);
    try {
      await put('/admin/settings', {
        group: 'site',
        config: siteConfig,
      });
      toast.success(t('saveSuccess'));
      onMutate();
      // 更新所有使用 site-status 的组件
      globalMutate('site-status');
    } catch (error: any) {
      // 优先使用后端返回的错误消息
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
        <CardTitle>{t('site.title')}</CardTitle>
        <CardDescription>{t('site.description')}</CardDescription>
      </CardHeader>
      <Divider />
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

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? t('saving') : t('save')}
        </Button>
      </CardContent>
    </Card>
  );
}
