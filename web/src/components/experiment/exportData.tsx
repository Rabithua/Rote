import { Divider } from '@/components/ui/divider';
import type { Statistics } from '@/types/main';
import { API_POINT, get } from '@/utils/api';
import { authService } from '@/utils/auth';
import { useAPIGet } from '@/utils/fetcher';
import { DownloadCloud } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidingNumber } from '../animate-ui/text/sliding-number';
import LoadingPlaceholder from '../others/LoadingPlaceholder';

export default function ExportData() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.exportData',
  });
  const [isDownloading, setIsDownloading] = useState(false);

  const { isLoading, data } = useAPIGet<Statistics>('statistics', () =>
    get('/users/me/statistics').then((res) => res.data)
  );

  // 处理文件下载
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const token = authService.getAccessToken();

      if (!token || authService.isTokenExpired(token)) {
        throw new Error('认证token无效或已过期');
      }

      const response = await fetch(`${API_POINT}/v2/api/users/me/export`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'export-data.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('下载失败:', error);
      // 这里可以添加用户友好的错误提示
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="noScrollBar relative aspect-square w-full overflow-x-hidden overflow-y-scroll p-4">
      <div className="text-2xl font-semibold">
        {t('title')} <br />
        <div className="text-info mt-2 text-sm font-normal">{t('description')}</div>
      </div>
      <Divider></Divider>
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : (
        <>
          <div className="flex items-center justify-around p-4">
            <div className="flex flex-col items-center justify-center gap-2">
              <SlidingNumber
                className="text-4xl font-semibold"
                number={data?.noteCount || '0'}
              ></SlidingNumber>
              <div className="text-info text-sm">{t('noteCount')}</div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              <SlidingNumber
                className="text-4xl font-semibold"
                number={data?.attachmentsCount || '0'}
              ></SlidingNumber>
              <div className="text-info text-sm">{t('attachmentCount')}</div>
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-foreground text-primary-foreground hover:text-primary-foreground mx-auto mt-6 flex w-fit cursor-pointer items-center gap-2 rounded-md px-6 py-2 duration-300 select-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DownloadCloud className="size-4" />
            {isDownloading ? t('downloading') : t('downloadJson')}
          </button>
        </>
      )}
    </div>
  );
}
