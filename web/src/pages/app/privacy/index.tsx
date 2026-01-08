import MarkdownDocPage from '@/components/others/MarkdownDocPage';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';

function PrivacyPolicyPage() {
  const { t } = useTranslation('translation');
  const pageTitle = t('pages.privacy.title', { defaultValue: '隐私政策' });
  const pageDescription = t('pages.privacy.loading', { defaultValue: '隐私政策页面' });

  const buildPath = (lang: string) => {
    const short = lang.slice(0, 2);
    const normalized = ['zh', 'en', 'ja'].includes(short) ? short : 'en';
    return `/src/doc/privacy/privacy.${normalized}.md`;
  };

  return (
    <>
      <PageMeta title={pageTitle} description={pageDescription} />

      <MarkdownDocPage
        buildPath={buildPath}
        loadingText={t('pages.privacy.loading', 'Loading privacy policy...')}
      />
    </>
  );
}

export default PrivacyPolicyPage;
