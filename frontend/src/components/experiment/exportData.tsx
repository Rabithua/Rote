import { apiGetStatistics } from '@/api/rote/main';
import { Divider } from '@/components/ui/divider';
import { DownloadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LoadingPlaceholder from '../LoadingPlaceholder';
export default function ExportData() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.exportData',
  });
  const [loading, setLoading] = useState(true);
  const [statisics, setStatistics] = useState<any>({
    noteCount: 0,
    attachmentsCount: 0,
  });

  function exportData() {
    apiGetStatistics()
      .then((res: any) => {
        setLoading(false);
        console.log(res);
        setStatistics(res.data.data);
      })
      .catch(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    exportData();
  }, []);

  return (
    <div className="noScrollBar relative aspect-square w-full overflow-x-hidden overflow-y-scroll p-4">
      <div className="text-2xl font-semibold">
        {t('title')} <br />
        <div className="mt-2 text-sm font-normal text-gray-500">{t('description')}</div>
      </div>
      <Divider></Divider>
      {loading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : (
        <>
          <div className="flex items-center justify-around p-4">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="text-4xl font-semibold">{statisics.noteCount}</div>
              <div className="text-sm text-gray-500">{t('noteCount')}</div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="text-4xl font-semibold">{statisics.attachmentsCount}</div>
              <div className="text-sm text-gray-500">{t('attachmentCount')}</div>
            </div>
          </div>
          <Link
            to={`${process.env.REACT_APP_BASEURL_PRD}/v1/api/exportData`}
            className="dark:bg-opacityDark mx-auto mt-6 flex w-fit cursor-pointer items-center gap-2 rounded-md bg-black px-6 py-2 text-white duration-300 select-none hover:text-white active:scale-95"
            target="_blank"
            rel="noreferrer"
          >
            <DownloadCloud className="size-4" />
            {t('downloadJson')}
          </Link>
        </>
      )}
    </div>
  );
}
