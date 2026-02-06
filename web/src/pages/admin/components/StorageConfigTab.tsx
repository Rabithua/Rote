import S3ConfigForm from '@/components/common/S3ConfigForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { put } from '@/utils/api';
import { testStorageConnection } from '@/utils/setupApi';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { KeyedMutator } from 'swr';
import type { SystemConfig } from '../types';

interface StorageConfigTabProps {
  storageConfig: SystemConfig['storage'];
  setStorageConfig: (config: SystemConfig['storage']) => void;
  isSaving: boolean;
  setIsSaving: (isSaving: boolean) => void;
  isTesting: boolean;
  setIsTesting: (isTesting: boolean) => void;
  onMutate: KeyedMutator<SystemConfig>;
}

export default function StorageConfigTab({
  storageConfig,
  setStorageConfig,
  isSaving,
  setIsSaving,
  isTesting,
  setIsTesting,
  onMutate,
}: StorageConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.storage' });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!validate()) {
      toast.error(t('fillAllRequired'));
      return;
    }
    setIsSaving(true);
    try {
      await put('/admin/settings', { storage: storageConfig });
      await onMutate();
      toast.success(t('saveSuccess'));
    } catch (error: any) {
      toast.error(t('saveFailed', { error: error.message }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-none border-none shadow-none">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <S3ConfigForm
          config={storageConfig}
          onChange={(newConfig) => setStorageConfig(newConfig)}
          errors={errors}
          showTestConnection={false}
        />

        <div className="mt-6 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || isSaving}
          >
            {isTesting ? t('testing') : t('testConnection')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || isTesting}>
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
