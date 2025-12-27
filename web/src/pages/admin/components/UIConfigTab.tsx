import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { put } from '@/utils/api';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';

interface UIConfigTabProps {
  uiConfig: SystemConfig['ui'] | undefined;
  setUiConfig: (config: SystemConfig['ui'] | undefined) => void;
  securityConfig: SystemConfig['security'] | undefined;
  setSecurityConfig: (config: SystemConfig['security'] | undefined) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  onMutate: () => void;
}

export default function UIConfigTab({
  uiConfig,
  setUiConfig,
  securityConfig,
  setSecurityConfig,
  isSaving,
  setIsSaving,
  onMutate,
}: UIConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();

  const handleSave = async () => {
    // 验证必填字段
    if (!uiConfig) {
      toast.error(t('saveFailed', { error: 'UI configuration is required' }));
      return;
    }
    // 验证 apiRateLimit 必须大于等于 10
    if (
      uiConfig.apiRateLimit !== undefined &&
      (typeof uiConfig.apiRateLimit !== 'number' || uiConfig.apiRateLimit < 10)
    ) {
      toast.error(t('saveFailed', { error: 'API rate limit must be a number and at least 10' }));
      return;
    }
    // 验证 defaultUserRole 必须是有效角色
    if (uiConfig.defaultUserRole && !['user', 'moderator'].includes(uiConfig.defaultUserRole)) {
      toast.error(
        t('saveFailed', { error: 'Default user role must be either "user" or "moderator"' })
      );
      return;
    }
    setIsSaving(true);
    try {
      // 同时保存 UI 和安全配置
      await Promise.all([
        put('/admin/settings', {
          group: 'ui',
          config: uiConfig,
        }),
        put('/admin/settings', {
          group: 'security',
          config: securityConfig || { requireVerifiedEmailForExplore: false },
        }),
      ]);
      toast.success(t('saveSuccess'));
      onMutate();
      // 更新所有使用 site-status 的组件，确保 allowUploadFile 等配置实时生效
      globalMutate('site-status');
      // 安全配置变更后，刷新全局配置缓存
      globalMutate('/admin/settings');
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
        <CardTitle>{t('ui.title')}</CardTitle>
        <CardDescription>{t('ui.description')}</CardDescription>
      </CardHeader>
      <Divider />
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t('ui.allowRegistration')}</Label>
            <p className="text-muted-foreground text-sm">{t('ui.allowRegistrationDesc')}</p>
          </div>
          <Switch
            checked={uiConfig?.allowRegistration ?? true}
            onCheckedChange={(checked) =>
              setUiConfig({ ...(uiConfig || {}), allowRegistration: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t('ui.allowUploadFile')}</Label>
            <p className="text-muted-foreground text-sm">{t('ui.allowUploadFileDesc')}</p>
          </div>
          <Switch
            checked={uiConfig?.allowUploadFile ?? true}
            onCheckedChange={(checked) =>
              setUiConfig({ ...(uiConfig || {}), allowUploadFile: checked })
            }
          />
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="defaultUserRole">{t('ui.defaultUserRole')}</Label>
          <Select
            value={uiConfig?.defaultUserRole || 'user'}
            onValueChange={(value) => setUiConfig({ ...(uiConfig || {}), defaultUserRole: value })}
          >
            <SelectTrigger id="defaultUserRole" className="w-full">
              <SelectValue placeholder={t('ui.defaultUserRolePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{t('ui.roles.user')}</SelectItem>
              <SelectItem value="moderator">{t('ui.roles.moderator')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{t('ui.defaultUserRoleDescription')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiRateLimit">{t('ui.apiRateLimit')}</Label>
          <Input
            id="apiRateLimit"
            type="number"
            min="10"
            value={uiConfig?.apiRateLimit || 100}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              // 如果输入值小于10，设置为10；如果输入无效，保持当前值或使用默认值100
              if (!isNaN(value) && value >= 10) {
                setUiConfig({ ...(uiConfig || {}), apiRateLimit: value });
              } else if (!isNaN(value) && value < 10) {
                setUiConfig({ ...(uiConfig || {}), apiRateLimit: 10 });
              } else if (e.target.value === '') {
                // 允许清空，但保存时会验证
                setUiConfig({ ...(uiConfig || {}), apiRateLimit: undefined as any });
              }
            }}
          />
          <p className="text-muted-foreground text-xs">{t('ui.apiRateLimitDescription')}</p>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? t('saving') : t('save')}
        </Button>
      </CardContent>
    </Card>
  );
}
