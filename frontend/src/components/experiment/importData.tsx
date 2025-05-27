import { Divider } from '@/components/ui/divider';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LoadingPlaceholder from '../LoadingPlaceholder';

export default function ImportData() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData',
  });
  const [loading] = useState(false);

  useEffect(() => {}, []);

  return (
    <div className="noScrollBar relative aspect-square w-full overflow-x-hidden overflow-y-scroll p-4">
      <div className="text-2xl font-semibold">
        {t('title')} <br />
        <div className="mt-2 text-sm font-normal text-gray-500">{t('description')}</div>
      </div>
      <Divider></Divider>
      {loading ? <LoadingPlaceholder className="py-8" size={6} /> : null}
    </div>
  );
}
