import { useTranslation } from 'react-i18next';

export default function ErrorPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.error' });

  return (
    <>
      <main className="bg-bgLight dark:bg-bgDark flex h-dvh place-items-center items-center justify-center px-6">
        <div className="flex flex-col gap-5">
          <p className="bg-black bg-clip-text font-mono text-[100px] font-semibold text-black text-transparent lg:text-[200px] dark:text-white">
            404
          </p>
          <h1 className="text-base font-bold tracking-tight text-black/90 lg:text-2xl dark:text-white/90">
            {t('pageNotFound')}
          </h1>
          <p className="text-base leading-7 text-black/90 dark:text-white/90">
            {t('pageNotFoundDesc')}
          </p>
        </div>
      </main>
    </>
  );
}
