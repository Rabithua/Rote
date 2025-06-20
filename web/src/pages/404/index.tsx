import { useTranslation } from 'react-i18next';

export default function ErrorPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.error' });

  return (
    <>
      <main className="bg-background flex h-dvh place-items-center items-center justify-center px-6">
        <div className="flex flex-col gap-5">
          <p className="text-primary bg-black bg-clip-text font-mono text-[100px] font-semibold lg:text-[200px] dark:text-white">
            404
          </p>
          <h1 className="text-primary/90 text-base font-bold tracking-tight lg:text-2xl dark:text-white/90">
            {t('pageNotFound')}
          </h1>
          <p className="text-primary/90 text-base leading-7 dark:text-white/90">
            {t('pageNotFoundDesc')}
          </p>
        </div>
      </main>
    </>
  );
}
