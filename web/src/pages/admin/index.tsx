import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
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
import { Textarea } from '@/components/ui/textarea';
import { useProfile } from '@/state/profile';
import { get, put } from '@/utils/api';
import { testStorageConnection } from '@/utils/setupApi';
import { Database, Globe, Settings, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';

interface SystemConfig {
  site?: {
    name: string;
    frontendUrl: string;
    description?: string;
    defaultLanguage?: string;
    allowedOrigins?: string[];
  };
  storage?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    urlPrefix: string;
  };
  ui?: {
    theme?: string;
    language?: string;
    allowRegistration?: boolean;
    defaultUserRole?: string;
    apiRateLimit?: number;
    allowUploadFile?: boolean;
  };
}

export default function AdminDashboard() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const profile = useProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'site' | 'storage' | 'ui'>('site');

  const {
    data: configs,
    isLoading,
    mutate,
  } = useSWR<SystemConfig>(
    profile?.role === 'admin' || profile?.role === 'super_admin' ? '/admin/settings' : null,
    async () => {
      const res = await get('/admin/settings');
      // 后端返回的是 { site: {...}, storage: {...}, ui: {...} } 格式
      return res.data as SystemConfig;
    }
  );

  const [siteConfig, setSiteConfig] = useState<SystemConfig['site'] | undefined>(undefined);
  const [storageConfig, setStorageConfig] = useState<SystemConfig['storage'] | undefined>(
    undefined
  );
  const [uiConfig, setUiConfig] = useState<SystemConfig['ui'] | undefined>(undefined);

  useEffect(() => {
    if (configs) {
      if (configs.site) setSiteConfig(configs.site);
      // 存储配置可能为空，初始化为空对象以便用户添加配置
      setStorageConfig(
        configs.storage || {
          endpoint: '',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          urlPrefix: '',
        }
      );
      // UI 配置可能为空，初始化为默认值
      setUiConfig(
        configs.ui || {
          allowRegistration: true,
          allowUploadFile: true,
          defaultUserRole: 'user',
          apiRateLimit: 100,
        }
      );
    }
  }, [configs]);

  // 检查用户是否有管理员权限
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t('accessDenied')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminOnly')}</p>
        </div>
      </div>
    );
  }

  const handleSaveSite = async () => {
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
      mutate();
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

  const handleTestStorage = async () => {
    setIsTesting(true);
    try {
      const result = await testStorageConnection(storageConfig);

      if (result.success) {
        toast.success(t('storage.testSuccess'));
      } else {
        toast.error(
          t('storage.testFailed', {
            error: result.message || 'Unknown error',
          })
        );
      }
    } catch (error: any) {
      // 优先使用后端返回的错误消息
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(t('storage.testFailed', { error: errorMessage }));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveStorage = async () => {
    // 验证必填字段
    if (
      !storageConfig ||
      !storageConfig.endpoint?.trim() ||
      !storageConfig.bucket?.trim() ||
      !storageConfig.accessKeyId?.trim() ||
      !storageConfig.secretAccessKey?.trim()
    ) {
      toast.error(t('saveFailed', { error: 'Please fill in all required fields' }));
      return;
    }
    setIsSaving(true);
    try {
      await put('/admin/settings', {
        group: 'storage',
        config: storageConfig,
      });
      toast.success(t('saveSuccess'));
      mutate();
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

  const handleSaveUI = async () => {
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
      await put('/admin/settings', {
        group: 'ui',
        config: uiConfig,
      });
      toast.success(t('saveSuccess'));
      mutate();
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

  if (isLoading) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

  return (
    <div className="noScrollBar relative flex-1 divide-y overflow-x-hidden overflow-y-visible pb-20">
      <NavBar title={t('title')} icon={<Shield className="size-6" />} />

      <div className="flex flex-col divide-y">
        {/* Tab 导航 */}
        <div className="noScrollBar flex divide-x overflow-x-scroll">
          <Button
            variant={activeTab === 'site' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('site')}
            className="flex items-center gap-2 rounded-none"
          >
            <Globe className="size-4" />
            {t('tabs.site')}
          </Button>
          <Button
            variant={activeTab === 'storage' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('storage')}
            className="flex items-center gap-2 rounded-none"
          >
            <Database className="size-4" />
            {t('tabs.storage')}
          </Button>
          <Button
            variant={activeTab === 'ui' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('ui')}
            className="flex items-center gap-2 rounded-none"
          >
            <Settings className="size-4" />
            {t('tabs.ui')}
          </Button>
        </div>

        {/* 站点配置 */}
        {activeTab === 'site' && (
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
                      ...siteConfig,
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
                      ...siteConfig,
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
                      ...siteConfig,
                      name: siteConfig?.name || '',
                      frontendUrl: siteConfig?.frontendUrl || '',
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>

              <Button onClick={handleSaveSite} disabled={isSaving} className="w-full">
                {isSaving ? t('saving') : t('save')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 存储配置 */}
        {activeTab === 'storage' && (
          <Card className="rounded-none border-none shadow-none">
            <CardHeader className="pb-0">
              <CardTitle>{t('storage.title')}</CardTitle>
              <CardDescription>{t('storage.description')}</CardDescription>
            </CardHeader>
            <Divider />
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="endpoint">{t('storage.endpoint')}</Label>
                <Input
                  id="endpoint"
                  value={storageConfig?.endpoint || ''}
                  onChange={(e) =>
                    setStorageConfig({
                      endpoint: e.target.value,
                      bucket: storageConfig?.bucket || '',
                      accessKeyId: storageConfig?.accessKeyId || '',
                      secretAccessKey: storageConfig?.secretAccessKey || '',
                      urlPrefix: storageConfig?.urlPrefix || '',
                    })
                  }
                  placeholder="https://account-id.r2.cloudflarestorage.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bucket">{t('storage.bucket')}</Label>
                <Input
                  id="bucket"
                  value={storageConfig?.bucket || ''}
                  onChange={(e) =>
                    setStorageConfig({
                      endpoint: storageConfig?.endpoint || '',
                      bucket: e.target.value,
                      accessKeyId: storageConfig?.accessKeyId || '',
                      secretAccessKey: storageConfig?.secretAccessKey || '',
                      urlPrefix: storageConfig?.urlPrefix || '',
                    })
                  }
                  placeholder="bucket-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessKeyId">{t('storage.accessKeyId')}</Label>
                <Input
                  id="accessKeyId"
                  value={storageConfig?.accessKeyId || ''}
                  onChange={(e) =>
                    setStorageConfig({
                      endpoint: storageConfig?.endpoint || '',
                      bucket: storageConfig?.bucket || '',
                      accessKeyId: e.target.value,
                      secretAccessKey: storageConfig?.secretAccessKey || '',
                      urlPrefix: storageConfig?.urlPrefix || '',
                    })
                  }
                  placeholder="Access Key ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secretAccessKey">{t('storage.secretAccessKey')}</Label>
                <Input
                  id="secretAccessKey"
                  type="password"
                  value={storageConfig?.secretAccessKey || ''}
                  onChange={(e) =>
                    setStorageConfig({
                      endpoint: storageConfig?.endpoint || '',
                      bucket: storageConfig?.bucket || '',
                      accessKeyId: storageConfig?.accessKeyId || '',
                      secretAccessKey: e.target.value,
                      urlPrefix: storageConfig?.urlPrefix || '',
                    })
                  }
                  placeholder="Secret Access Key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urlPrefix">{t('storage.urlPrefix')}</Label>
                <Input
                  id="urlPrefix"
                  value={storageConfig?.urlPrefix || ''}
                  onChange={(e) =>
                    setStorageConfig({
                      endpoint: storageConfig?.endpoint || '',
                      bucket: storageConfig?.bucket || '',
                      accessKeyId: storageConfig?.accessKeyId || '',
                      secretAccessKey: storageConfig?.secretAccessKey || '',
                      urlPrefix: e.target.value,
                    })
                  }
                  placeholder="https://your-cdn-domain.com"
                />
                <p className="text-muted-foreground text-xs">{t('storage.urlPrefixDescription')}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestStorage}
                  disabled={isTesting || isSaving}
                  className="flex-1"
                >
                  {isTesting ? t('storage.testing') : t('storage.testConnection')}
                </Button>
                <Button
                  onClick={handleSaveStorage}
                  disabled={isSaving || isTesting}
                  className="flex-1"
                >
                  {isSaving ? t('saving') : t('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* UI 配置 */}
        {activeTab === 'ui' && (
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
                    setUiConfig({ ...uiConfig, allowRegistration: checked })
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
                    setUiConfig({ ...uiConfig, allowUploadFile: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultUserRole">{t('ui.defaultUserRole')}</Label>
                <Select
                  value={uiConfig?.defaultUserRole || 'user'}
                  onValueChange={(value) => setUiConfig({ ...uiConfig, defaultUserRole: value })}
                >
                  <SelectTrigger id="defaultUserRole" className="w-full">
                    <SelectValue placeholder={t('ui.defaultUserRolePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t('ui.roles.user')}</SelectItem>
                    <SelectItem value="moderator">{t('ui.roles.moderator')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {t('ui.defaultUserRoleDescription')}
                </p>
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
                      setUiConfig({ ...uiConfig, apiRateLimit: value });
                    } else if (!isNaN(value) && value < 10) {
                      setUiConfig({ ...uiConfig, apiRateLimit: 10 });
                    } else if (e.target.value === '') {
                      // 允许清空，但保存时会验证
                      setUiConfig({ ...uiConfig, apiRateLimit: undefined as any });
                    }
                  }}
                />
                <p className="text-muted-foreground text-xs">{t('ui.apiRateLimitDescription')}</p>
              </div>

              <Button onClick={handleSaveUI} disabled={isSaving} className="w-full">
                {isSaving ? t('saving') : t('save')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
