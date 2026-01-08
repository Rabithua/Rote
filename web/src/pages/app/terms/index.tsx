import MarkdownDocPage from '@/components/others/MarkdownDocPage';
import { useTranslation } from 'react-i18next';

function TermsOfServicePage() {
  const { t } = useTranslation('translation');

  const buildPath = (lang: string) => {
    const short = lang.slice(0, 2);
    const normalized = ['zh', 'en', 'ja'].includes(short) ? short : 'en';
    return `/src/doc/terms/terms.${normalized}.md`;
  };

  return (
    <MarkdownDocPage
      buildPath={buildPath}
      loadingText={t('pages.terms.loading', 'Loading terms of service...')}
    />
  );
}

export default TermsOfServicePage;
