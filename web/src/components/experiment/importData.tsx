import { Divider } from '@/components/ui/divider';
import { useTranslation } from 'react-i18next';

export default function ImportData() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData',
  });

  return (
    <div className="noScrollBar relative aspect-square w-full overflow-x-hidden overflow-y-scroll p-4">
      <div className="text-2xl font-semibold">
        {t('title')} <br />
        <div className="text-info mt-2 text-sm font-normal">{t('description')}</div>
      </div>
      <Divider></Divider>
      <div className="bg-background/90 absolute top-0 left-0 flex h-full w-full flex-col items-center justify-center gap-2 backdrop-blur-xl">
        <div className="text-2xl">🚧</div>
        <div>{t('notSupported')}</div>
      </div>
    </div>
  );
}
