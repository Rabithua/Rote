import MarkdownDocPage from '@/components/others/MarkdownDocPage';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';

function TermsOfServicePage() {
  const { t } = useTranslation('translation');
  const pageTitle = t('pages.terms.title', { defaultValue: '服务条款' });
  const pageDescription = t('pages.terms.loading', { defaultValue: '服务条款页面' });

  const buildPath = (lang: string) => {
    const short = lang.slice(0, 2);
    const normalized = ['zh', 'en', 'ja'].includes(short) ? short : 'en';
    return `/src/doc/terms/terms.${normalized}.md`;
  };

  return (
    <>
      <PageMeta title={pageTitle} description={pageDescription} />

      <MarkdownDocPage
        buildPath={buildPath}
        loadingText={t('pages.terms.loading', 'Loading terms of service...')}
      />
    </>
  );
}

export default TermsOfServicePage;
