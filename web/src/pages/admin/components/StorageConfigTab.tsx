import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { put } from '@/utils/api';
import { testStorageConnection } from '@/utils/setupApi';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';

interface StorageConfigTabProps {
  storageConfig: SystemConfig['storage'] | undefined;
  setStorageConfig: (config: SystemConfig['storage'] | undefined) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  isTesting: boolean;
  setIsTesting: (testing: boolean) => void;
  onMutate: () => void;
}

// 判断是否为 R2 endpoint 格式
const isR2Endpoint = (endpoint: string) => {
  const r2Pattern = /^https:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com$/;
  return r2Pattern.test(endpoint);
};

// 从 R2 endpoint 提取 account ID
const extractAccountIdFromEndpoint = (endpoint: string) => {
  const r2Pattern = /^https:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com$/;
  const match = endpoint.match(r2Pattern);
  return match ? match[1] : '';
};

export default function StorageConfigTab({
  storageConfig,
  setStorageConfig,
  isSaving,
  setIsSaving,
  isTesting,
  setIsTesting,
  onMutate,
}: StorageConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: globalMutate } = useSWRConfig();

  // 根据现有配置计算模式（使用派生状态而非 useEffect）
  const isR2EndpointFormat = storageConfig?.endpoint ? isR2Endpoint(storageConfig.endpoint) : true;

  // 存储类型模式：false = R2 模式，true = 自定义 Endpoint 模式
  const [useCustomEndpoint, setUseCustomEndpoint] = useState(() => {
    // 初始化时根据现有配置判断模式
    if (storageConfig?.endpoint) {
      return !isR2Endpoint(storageConfig.endpoint);
    }
    return false; // 默认 R2 模式
  });

  // R2 Account ID（从 endpoint 提取或单独存储）
  const [accountId, setAccountId] = useState(() => {
    if (storageConfig?.endpoint && isR2Endpoint(storageConfig.endpoint)) {
      return extractAccountIdFromEndpoint(storageConfig.endpoint);
    }
    return '';
  });

  // 当 endpoint 变化时，如果是 R2 格式，更新 accountId
  const currentAccountId =
    storageConfig?.endpoint && isR2EndpointFormat
      ? extractAccountIdFromEndpoint(storageConfig.endpoint)
      : accountId;

  const handleTest = async () => {
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

  const handleSave = async () => {
    // 验证必填字段
    if (
      !storageConfig ||
      !storageConfig.endpoint?.trim() ||
      !storageConfig.bucket?.trim() ||
      !storageConfig.accessKeyId?.trim() ||
      !storageConfig.secretAccessKey?.trim()
    ) {
      toast.error(t('storage.fillAllRequired'));
      return;
    }
    setIsSaving(true);
    try {
      await put('/admin/settings', {
        group: 'storage',
        config: storageConfig,
      });
      toast.success(t('saveSuccess'));
      onMutate();
      // 更新所有使用 site-status 的组件，确保存储配置实时生效
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
        <CardTitle>{t('storage.title')}</CardTitle>
        <CardDescription>{t('storage.description')}</CardDescription>
      </CardHeader>
      <Divider />
      <CardContent className="space-y-4">
        {/* 存储类型切换 */}
        <div className="space-y-2">
          <Label>{t('storage.storageType')}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={!useCustomEndpoint ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setUseCustomEndpoint(false);
                // 如果有 accountId，更新 endpoint 为 R2 格式
                if (currentAccountId) {
                  setStorageConfig({
                    endpoint: `https://${currentAccountId}.r2.cloudflarestorage.com`,
                    bucket: storageConfig?.bucket || '',
                    accessKeyId: storageConfig?.accessKeyId || '',
                    secretAccessKey: storageConfig?.secretAccessKey || '',
                    region: storageConfig?.region || 'auto',
                    urlPrefix: storageConfig?.urlPrefix || '',
                  });
                }
              }}
            >
              Cloudflare R2
            </Button>
            <Button
              type="button"
              variant={useCustomEndpoint ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseCustomEndpoint(true)}
            >
              {t('storage.customEndpoint')}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">{t('storage.storageTypeDescription')}</p>
        </div>

        {/* R2 模式：Account ID */}
        {!useCustomEndpoint && (
          <div className="space-y-2">
            <Label htmlFor="accountId">{t('storage.accountId')}</Label>
            <Input
              id="accountId"
              value={currentAccountId}
              onChange={(e) => {
                const newAccountId = e.target.value;
                setAccountId(newAccountId);
                // 自动生成 R2 endpoint
                setStorageConfig({
                  endpoint: newAccountId ? `https://${newAccountId}.r2.cloudflarestorage.com` : '',
                  bucket: storageConfig?.bucket || '',
                  accessKeyId: storageConfig?.accessKeyId || '',
                  secretAccessKey: storageConfig?.secretAccessKey || '',
                  region: storageConfig?.region || 'auto',
                  urlPrefix: storageConfig?.urlPrefix || '',
                });
              }}
              placeholder={t('storage.accountIdPlaceholder')}
            />
          </div>
        )}

        {/* 自定义 Endpoint 模式 */}
        {useCustomEndpoint && (
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
                  region: storageConfig?.region || '',
                  urlPrefix: storageConfig?.urlPrefix || '',
                })
              }
              placeholder={t('storage.endpointPlaceholder')}
            />
            <p className="text-muted-foreground text-xs">{t('storage.endpointDescription')}</p>
          </div>
        )}

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
                region: storageConfig?.region || '',
                urlPrefix: storageConfig?.urlPrefix || '',
              })
            }
            placeholder={t('storage.accessKeyIdPlaceholder')}
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
                region: storageConfig?.region || '',
                urlPrefix: storageConfig?.urlPrefix || '',
              })
            }
            placeholder={t('storage.secretAccessKeyPlaceholder')}
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
                region: storageConfig?.region || '',
                urlPrefix: storageConfig?.urlPrefix || '',
              })
            }
            placeholder={t('storage.bucketPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">{t('storage.region')}</Label>
          <Input
            id="region"
            value={storageConfig?.region || ''}
            onChange={(e) =>
              setStorageConfig({
                endpoint: storageConfig?.endpoint || '',
                bucket: storageConfig?.bucket || '',
                accessKeyId: storageConfig?.accessKeyId || '',
                secretAccessKey: storageConfig?.secretAccessKey || '',
                region: e.target.value,
                urlPrefix: storageConfig?.urlPrefix || '',
              })
            }
            placeholder={t('storage.regionPlaceholder')}
          />
          <p className="text-muted-foreground text-xs">{t('storage.regionDescription')}</p>
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
                region: storageConfig?.region || '',
                urlPrefix: e.target.value,
              })
            }
            placeholder={t('storage.urlPrefixPlaceholder')}
          />
          <p className="text-muted-foreground text-xs">{t('storage.urlPrefixDescription')}</p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || isSaving}
            className="flex-1"
          >
            {isTesting ? t('storage.testing') : t('storage.testConnection')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isTesting} className="flex-1">
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
