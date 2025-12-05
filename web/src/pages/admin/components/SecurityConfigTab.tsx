import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { put } from '@/utils/api';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';

interface SecurityConfigTabProps {
  securityConfig: SystemConfig['security'] | undefined;
  setSecurityConfig: (config: SystemConfig['security'] | undefined) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  onMutate: () => void;
}

export default function SecurityConfigTab({
  securityConfig,
  setSecurityConfig,
  isSaving,
  setIsSaving,
  onMutate,
}: SecurityConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();

  const handleSave = async () => {
    if (!securityConfig) {
      setSecurityConfig({
        requireVerifiedEmailForExplore: false,
      });
    }

    setIsSaving(true);
    try {
      await put('/admin/settings', {
        group: 'security',
        config: securityConfig || { requireVerifiedEmailForExplore: false },
      });
      toast.success(t('saveSuccess'));
      onMutate();
      // 安全配置变更后，刷新全局配置缓存（后端已提供刷新端点，这里只需刷新本页数据）
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
        <CardTitle>{t('security.title')}</CardTitle>
        <CardDescription>{t('security.description')}</CardDescription>
      </CardHeader>
      <Divider />
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t('security.requireVerifiedEmailForExplore')}</Label>
            <p className="text-muted-foreground text-sm">
              {t('security.requireVerifiedEmailForExploreDesc')}
            </p>
          </div>
          <Switch
            checked={securityConfig?.requireVerifiedEmailForExplore ?? false}
            onCheckedChange={(checked) =>
              setSecurityConfig({
                ...(securityConfig || {}),
                requireVerifiedEmailForExplore: checked,
              })
            }
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? t('saving') : t('save')}
        </Button>
      </CardContent>
    </Card>
  );
}
