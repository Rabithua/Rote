import EveCat from '@/components/experiment/EveCat';
import ExportData from '@/components/experiment/exportData';
import ImportData from '@/components/experiment/importData';
import ServiceWorker from '@/components/experiment/serviceWorker';
import NavBar from '@/components/layout/navBar';
import { Snail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ExperimentPage() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment',
  });
  return (
    <div className="noScrollBar relative flex-1 divide-y overflow-x-hidden overflow-y-visible pb-20">
      <NavBar title={`${t('title')}`} icon={<Snail className="size-6" />} />
      <div className="flex w-full flex-col divide-y">
        <div className="px-4 py-3 font-thin">{t('description')}</div>
        <div className="divide-x divide-y sm:grid sm:grid-cols-2">
          <ServiceWorker />
          <ExportData />
          <ImportData />
          <EveCat />
        </div>
      </div>
    </div>
  );
}
