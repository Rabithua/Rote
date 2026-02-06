import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { testStorageConnection } from '@/utils/setupApi';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { SystemConfig } from '../../pages/admin/types';

import {
  extractAccountIdFromEndpoint,
  extractCosRegionFromEndpoint,
  getCosEndpoint,
  getStorageTypeFromEndpoint,
  isR2Endpoint,
} from '@/utils/s3';

interface S3ConfigFormProps {
  config: SystemConfig['storage'] | undefined;
  onChange: (config: SystemConfig['storage']) => void;
  errors?: Record<string, string>;
  description?: React.ReactNode;
  showTestConnection?: boolean;
}

export default function S3ConfigForm({
  config,
  onChange,
  errors = {},
  description,
  showTestConnection = true,
}: S3ConfigFormProps) {
  const { t } = useTranslation('translation');
  const [isTesting, setIsTesting] = useState(false);

  // Derived state for storage type
  const [userSelectedType, setUserSelectedType] = useState<'r2' | 'cos' | 'custom' | null>(null);
  const derivedType = getStorageTypeFromEndpoint(config?.endpoint);
  const storageType = userSelectedType ?? derivedType;

  // Local state for R2 Account ID to allow easier editing
  const [localAccountId, setLocalAccountId] = useState(() => {
    if (config?.endpoint && isR2Endpoint(config.endpoint)) {
      return extractAccountIdFromEndpoint(config.endpoint);
    }
    return '';
  });

  const isR2 = storageType === 'r2';
  const isCos = storageType === 'cos';

  const updateStorageType = (nextType: 'r2' | 'cos' | 'custom') => {
    let nextEndpoint = '';
    let nextRegion = '';

    if (nextType === 'r2') {
      const accountIdToUse = localAccountId || '';
      nextEndpoint = accountIdToUse ? `https://${accountIdToUse}.r2.cloudflarestorage.com` : '';
      nextRegion = 'auto';
    } else if (nextType === 'cos') {
      const inferredRegion = config?.endpoint ? extractCosRegionFromEndpoint(config.endpoint) : '';
      nextRegion =
        config?.region && config.region !== 'auto' ? config.region : inferredRegion || '';
      nextEndpoint = getCosEndpoint(nextRegion);
    } else {
      // Custom
      nextEndpoint = config?.endpoint || '';
      nextRegion = config?.region === 'auto' ? '' : config?.region || '';
    }

    setUserSelectedType(nextType);

    onChange({
      ...config!,
      endpoint: nextEndpoint,
      region: nextRegion,
    });
  };

  const currentAccountId =
    config?.endpoint && isR2Endpoint(config.endpoint)
      ? extractAccountIdFromEndpoint(config.endpoint)
      : localAccountId;

  const handleTest = async () => {
    if (
      !config?.endpoint?.trim() ||
      !config?.bucket?.trim() ||
      !config?.accessKeyId?.trim() ||
      !config?.secretAccessKey?.trim() ||
      !config?.urlPrefix?.trim() ||
      (storageType === 'cos' && !config?.region?.trim())
    ) {
      toast.error(t('pages.admin.storage.fillAllRequired'));
      return;
    }
    setIsTesting(true);
    try {
      const result = await testStorageConnection(config);

      if (result.success) {
        toast.success(t('pages.admin.storage.testSuccess'));
      } else {
        toast.error(
          `${t('pages.admin.storage.testFailed', {
            error: result.message || 'Unknown error',
          })} ${t('pages.admin.storage.seeConsole')}`
        );
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(
        `${t('pages.admin.storage.testFailed', { error: errorMessage })} ${t('pages.admin.storage.seeConsole')}`
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {description && <div className="text-muted-foreground mb-4 text-sm">{description}</div>}

      <div className="space-y-2">
        <Label>{t('pages.admin.storage.storageType')}</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isR2 ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateStorageType('r2')}
          >
            Cloudflare R2
          </Button>
          <Button
            type="button"
            variant={isCos ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateStorageType('cos')}
          >
            {t('pages.admin.storage.cos')}
          </Button>
          <Button
            type="button"
            variant={!isR2 && !isCos ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateStorageType('custom')}
          >
            {t('pages.admin.storage.customEndpoint')}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {t('pages.admin.storage.storageTypeDescription')}
        </p>
      </div>

      {/* R2 Account ID */}
      {isR2 && (
        <div className="space-y-2">
          <Label htmlFor="accountId">{t('pages.admin.storage.accountId')}</Label>
          <Input
            id="accountId"
            value={currentAccountId}
            onChange={(e) => {
              const newAccountId = e.target.value;
              setLocalAccountId(newAccountId);
              onChange({
                ...config!,
                endpoint: newAccountId ? `https://${newAccountId}.r2.cloudflarestorage.com` : '',
                region: 'auto',
              });
            }}
            placeholder={t('pages.admin.storage.accountIdPlaceholder')}
            className={errors.accountId ? 'border-destructive' : ''}
          />
          {errors.accountId && <p className="text-destructive text-sm">{errors.accountId}</p>}
        </div>
      )}

      {/* COS / Custom Endpoint */}
      {!isR2 && (
        <div className="space-y-2">
          <Label htmlFor="endpoint">
            {isCos ? t('pages.admin.storage.cosEndpoint') : t('pages.admin.storage.endpoint')}
          </Label>
          <Input
            id="endpoint"
            value={config?.endpoint || ''}
            onChange={(e) => {
              const val = e.target.value;
              const newRegion = isCos
                ? extractCosRegionFromEndpoint(val) || config?.region || ''
                : config?.region || '';
              onChange({ ...config!, endpoint: val, region: newRegion });
            }}
            placeholder={
              isCos
                ? t('pages.admin.storage.cosEndpointPlaceholder')
                : t('pages.admin.storage.endpointPlaceholder')
            }
            className={errors.endpoint ? 'border-destructive' : ''}
          />
          <p className="text-muted-foreground text-xs">
            {isCos
              ? t('pages.admin.storage.cosEndpointDescription')
              : t('pages.admin.storage.endpointDescription')}
          </p>
          {errors.endpoint && <p className="text-destructive text-sm">{errors.endpoint}</p>}
        </div>
      )}

      {/* Access Key */}
      <div className="space-y-2">
        <Label htmlFor="accessKeyId">{t('pages.admin.storage.accessKeyId')}</Label>
        <Input
          id="accessKeyId"
          value={config?.accessKeyId || ''}
          onChange={(e) => onChange({ ...config!, accessKeyId: e.target.value })}
          placeholder={t('pages.admin.storage.accessKeyIdPlaceholder')}
          className={errors.accessKeyId ? 'border-destructive' : ''}
        />
        {errors.accessKeyId && <p className="text-destructive text-sm">{errors.accessKeyId}</p>}
      </div>

      {/* Secret Key */}
      <div className="space-y-2">
        <Label htmlFor="secretAccessKey">{t('pages.admin.storage.secretAccessKey')}</Label>
        <Input
          id="secretAccessKey"
          type="password"
          value={config?.secretAccessKey || ''}
          onChange={(e) => onChange({ ...config!, secretAccessKey: e.target.value })}
          placeholder={t('pages.admin.storage.secretAccessKeyPlaceholder')}
          className={errors.secretAccessKey ? 'border-destructive' : ''}
        />
        {errors.secretAccessKey && (
          <p className="text-destructive text-sm">{errors.secretAccessKey}</p>
        )}
      </div>

      {/* Bucket */}
      <div className="space-y-2">
        <Label htmlFor="bucket">{t('pages.admin.storage.bucket')}</Label>
        <Input
          id="bucket"
          value={config?.bucket || ''}
          onChange={(e) => onChange({ ...config!, bucket: e.target.value })}
          placeholder={t('pages.admin.storage.bucketPlaceholder')}
          className={errors.bucket ? 'border-destructive' : ''}
        />
        {errors.bucket && <p className="text-destructive text-sm">{errors.bucket}</p>}
      </div>

      {/* Region (Non-R2) */}
      {!isR2 && (
        <div className="space-y-2">
          <Label htmlFor="region">{t('pages.admin.storage.region')}</Label>
          <Input
            id="region"
            value={config?.region || ''}
            onChange={(e) =>
              onChange({
                ...config!,
                region: e.target.value,
                endpoint: isCos ? getCosEndpoint(e.target.value.trim()) : config?.endpoint || '',
              })
            }
            placeholder={
              isCos
                ? t('pages.admin.storage.cosRegionPlaceholder')
                : t('pages.admin.storage.regionPlaceholder')
            }
            className={errors.region ? 'border-destructive' : ''}
          />
          <p className="text-muted-foreground text-xs">
            {isCos
              ? t('pages.admin.storage.cosRegionDescription')
              : t('pages.admin.storage.regionDescription')}
          </p>
          {errors.region && <p className="text-destructive text-sm">{errors.region}</p>}
        </div>
      )}

      {/* URL Prefix */}
      <div className="space-y-2">
        <Label htmlFor="urlPrefix">{t('pages.admin.storage.urlPrefix')}</Label>
        <Input
          id="urlPrefix"
          value={config?.urlPrefix || ''}
          onChange={(e) => onChange({ ...config!, urlPrefix: e.target.value })}
          placeholder={t('pages.admin.storage.urlPrefixPlaceholder')}
          className={errors.urlPrefix ? 'border-destructive' : ''}
        />
        <p className="text-muted-foreground text-xs">
          {t('pages.admin.storage.urlPrefixDescription')}
        </p>
        {errors.urlPrefix && <p className="text-destructive text-sm">{errors.urlPrefix}</p>}
      </div>

      {showTestConnection && (
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting}
            className="w-full"
          >
            {isTesting ? t('pages.admin.storage.testing') : t('pages.admin.storage.testConnection')}
          </Button>
        </div>
      )}
    </div>
  );
}
