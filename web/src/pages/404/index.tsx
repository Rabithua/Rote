import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';

export default function ErrorPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.error' });
  const pageTitle = t('pageNotFound', { defaultValue: '页面未找到' });
  const pageDescription = t('pageNotFoundDesc', { defaultValue: '抱歉，您访问的页面不存在' });

  return (
    <>
      <PageMeta title={pageTitle} description={pageDescription} robots="noindex, nofollow" />

      <main className="bg-background flex h-dvh place-items-center items-center justify-center px-6">
        <div className="flex flex-col gap-2">
          <p className="text-primary bg-black bg-clip-text font-mono text-[100px] font-semibold lg:text-[200px] dark:text-white">
            40X
          </p>
          <h1 className="text-primary/90 text-base font-bold tracking-tight lg:text-2xl dark:text-white/90">
            {t('pageNotFound')}
          </h1>
          <p className="text-primary/50 text-xs font-light dark:text-white/50">
            {t('pageNotFoundDesc')}
          </p>
        </div>
      </main>
    </>
  );
}
