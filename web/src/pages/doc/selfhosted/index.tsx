import MarkdownDocPage from '@/components/others/MarkdownDocPage';
import { useTranslation } from 'react-i18next';

function SelfhostedGuidePage() {
  const { t } = useTranslation('translation');

  const buildPath = (lang: string) => {
    const short = lang.slice(0, 2);
    const normalized = ['zh', 'en', 'ja'].includes(short) ? short : 'en';
    return `/src/doc/selfhosted/selfhosted.${normalized}.md`;
  };

  return (
    <MarkdownDocPage
      buildPath={buildPath}
      loadingText={t('pages.selfhosted.loading', 'Loading self-hosted guide...')}
    />
  );
}

export default SelfhostedGuidePage;
