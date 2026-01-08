import MarkdownDocPage from '@/components/others/MarkdownDocPage';
import { useTranslation } from 'react-i18next';

function PrivacyPolicyPage() {
  const { t } = useTranslation('translation');

  const buildPath = (lang: string) => {
    const short = lang.slice(0, 2);
    const normalized = ['zh', 'en', 'ja'].includes(short) ? short : 'en';
    return `/src/doc/privacy/privacy.${normalized}.md`;
  };

  return (
    <MarkdownDocPage
      buildPath={buildPath}
      loadingText={t('pages.privacy.loading', 'Loading privacy policy...')}
    />
  );
}

export default PrivacyPolicyPage;
