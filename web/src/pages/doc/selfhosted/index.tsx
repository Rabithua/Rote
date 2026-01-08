import MarkdownDocPage from '@/components/others/MarkdownDocPage';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';

function SelfhostedGuidePage() {
  const { t } = useTranslation('translation');
  const pageTitle = t('pages.selfhosted.title', { defaultValue: '自托管指南' });
  const pageDescription = t('pages.selfhosted.loading', { defaultValue: '自托管部署指南' });

  const buildPath = (lang: string) => {
    const short = lang.slice(0, 2);
    const normalized = ['zh', 'en', 'ja'].includes(short) ? short : 'en';
    return `/src/doc/selfhosted/selfhosted.${normalized}.md`;
  };

  return (
    <>
      <PageMeta title={pageTitle} description={pageDescription} />

      <MarkdownDocPage
        buildPath={buildPath}
        loadingText={t('pages.selfhosted.loading', 'Loading self-hosted guide...')}
      />
    </>
  );
}

export default SelfhostedGuidePage;
