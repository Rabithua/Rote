import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? t('saving') : t('save')}
        </Button>
      </CardContent>
    </Card>
  );
}
