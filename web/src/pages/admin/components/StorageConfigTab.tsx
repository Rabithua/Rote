import S3ConfigForm from '@/components/common/S3ConfigForm';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { put } from '@/utils/api';
import { probeCors, testStorageConnection } from '@/utils/setupApi';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { KeyedMutator } from 'swr';
import type { SystemConfig } from '../types';
import AdminSettingsPanel from '../settings/AdminSettingsPanel';

interface StorageConfigTabProps {
  storageConfig: SystemConfig['storage'];
  setStorageConfig: (config: SystemConfig['storage']) => void;
  isSaving: boolean;
  hasUnsavedChanges?: boolean;
  setIsSaving: (isSaving: boolean) => void;
  isTesting: boolean;
  setIsTesting: (isTesting: boolean) => void;
  onMutate: KeyedMutator<SystemConfig>;
  onSaved?: (config: SystemConfig['storage']) => void;
}

export default function StorageConfigTab({
  storageConfig,
  setStorageConfig,
  isSaving,
  hasUnsavedChanges = true,
  setIsSaving,
  isTesting,
  setIsTesting,
  onMutate,
  onSaved,
}: StorageConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.storage' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!storageConfig?.endpoint) newErrors.endpoint = t('required');
    if (!storageConfig?.bucket) newErrors.bucket = t('required');
    if (!storageConfig?.accessKeyId) newErrors.accessKeyId = t('required');
    if (!storageConfig?.secretAccessKey) newErrors.secretAccessKey = t('required');
    if (!storageConfig?.urlPrefix) newErrors.urlPrefix = t('required');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTest = async () => {
    if (!validate()) {
      toast.error(t('fillAllRequired'));
      return;
    }
    setIsTesting(true);
    try {
      const result = await testStorageConnection(storageConfig);
      if (result.success) {
        toast.success(t('testSuccess'));

        // 浏览器侧 CORS 探测
        if (result.probeUrl) {
          const corsResult = await probeCors(result.probeUrl, { method: 'PUT' });
          if (corsResult.ok) {
            toast.success(t('corsSuccess'));
          } else {
            toast.warning(t('corsFailed'), {
              duration: 8000,
              description: corsResult.reason,
            });
          }
        }

        // URL Prefix 探测
        if (result.urlPrefixProbeUrl) {
          const urlPrefixResult = await probeCors(result.urlPrefixProbeUrl);
          if (urlPrefixResult.ok) {
            toast.success(t('urlPrefixSuccess'));
          } else {
            toast.warning(t('urlPrefixFailed'), {
              duration: 8000,
            });
          }
        }
      } else {
        toast.error(`${t('testFailed', { error: result.message })} ${t('seeConsole')}`);
      }
    } catch (error: any) {
      toast.error(`${t('testFailed', { error: error.message })} ${t('seeConsole')}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!validate()) {
      const message = t('fillAllRequired');
      setSaveError(message);
      toast.error(message);
      return;
    }
    setIsSaving(true);
    try {
      await put('/admin/settings', { group: 'storage', config: storageConfig });
      onSaved?.(storageConfig);
      toast.success(t('saveSuccess'));
      void onMutate();
    } catch (error: any) {
      const message = t('saveFailed', { error: error.message });
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
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
      }
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || isSaving}
          >
            {isTesting ? t('testing') : t('testConnection')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isTesting || !hasUnsavedChanges}
          >
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      }
    >
      <CardContent className="space-y-4">
        <S3ConfigForm
          config={storageConfig}
          onChange={(newConfig) => setStorageConfig(newConfig)}
          errors={errors}
          showTestConnection={false}
        />
      </CardContent>
    </AdminSettingsPanel>
  );
}
