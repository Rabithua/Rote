import LanguageSwitcher from '@/components/others/languageSwitcher';
import Logo from '@/components/others/logo';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function PrivacyPolicyPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.privacy' });

  return (
    <div className="bg-background min-h-dvh font-sans">
      {/* Header */}
      <div className="bg-background/90 sticky top-0 z-10 w-full border-b px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Logo className="h-6 w-auto opacity-90" color="#07C160" />
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <article className="prose prose-neutral dark:prose-invert prose-lg prose-headings:font-bold prose-h1:text-4xl prose-h1:tracking-tight prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-xl prose-strong:text-foreground prose-li:marker:text-primary/50 mx-auto">
          <div className="mb-12">
            <h1 className="mb-4">{t('title')}</h1>
            <p className="text-muted-foreground text-lg">{t('effectiveDate')}</p>
          </div>

          <blockquote>{t('welcome')}</blockquote>

          <h2>{t('sections.informationCollection.title')}</h2>
          <p>{t('sections.informationCollection.description')}</p>

          <h3>{t('sections.informationCollection.providedInfo.title')}</h3>
          <ul>
            <li>
              <strong>
                {t('sections.informationCollection.providedInfo.accountInfo.label')}：
              </strong>
              {t('sections.informationCollection.providedInfo.accountInfo.content')}
            </li>
            <li>
              <strong>
                {t('sections.informationCollection.providedInfo.userContent.label')}：
              </strong>
              {t('sections.informationCollection.providedInfo.userContent.content')}
            </li>
            <li>
              <strong>{t('sections.informationCollection.providedInfo.profile.label')}：</strong>
              {t('sections.informationCollection.providedInfo.profile.content')}
            </li>
          </ul>

          <h3>{t('sections.informationCollection.autoCollected.title')}</h3>
          <ul>
            <li>
              <strong>
                {t('sections.informationCollection.autoCollected.deviceInfo.label')}：
              </strong>
              {t('sections.informationCollection.autoCollected.deviceInfo.content')}
            </li>
          </ul>

          <h2>{t('sections.informationUsage.title')}</h2>
          <p>{t('sections.informationUsage.description')}</p>
          <ul>
            <li>
              <strong>{t('sections.informationUsage.provideService.label')}：</strong>
              {t('sections.informationUsage.provideService.content')}
            </li>
            <li>
              <strong>{t('sections.informationUsage.security.label')}：</strong>
              {t('sections.informationUsage.security.content')}
            </li>
            <li>
              <strong>{t('sections.informationUsage.communication.label')}：</strong>
              {t('sections.informationUsage.communication.content')}
            </li>
          </ul>

          <h2>{t('sections.informationSharing.title')}</h2>
          <p>{t('sections.informationSharing.description')}</p>
          <ul>
            <li>
              <strong>{t('sections.informationSharing.consent.label')}：</strong>
              {t('sections.informationSharing.consent.content')}
            </li>
            <li>
              <strong>{t('sections.informationSharing.legal.label')}：</strong>
              {t('sections.informationSharing.legal.content')}
            </li>
            <li>
              <strong>{t('sections.informationSharing.serviceProvider.label')}：</strong>
              {t('sections.informationSharing.serviceProvider.content')}
            </li>
          </ul>

          <h2>{t('sections.dataStorage.title')}</h2>
          <ul>
            <li>
              <strong>{t('sections.dataStorage.storage.label')}：</strong>
              {t('sections.dataStorage.storage.content')}
            </li>
            <li>
              <strong>{t('sections.dataStorage.security.label')}：</strong>
              {t('sections.dataStorage.security.content')}
            </li>
            <li>
              <strong>{t('sections.dataStorage.retention.label')}：</strong>
              {t('sections.dataStorage.retention.content')}
            </li>
          </ul>

          <h2>{t('sections.yourRights.title')}</h2>
          <p>{t('sections.yourRights.description')}</p>
          <ul>
            <li>
              <strong>{t('sections.yourRights.access.label')}：</strong>
              {t('sections.yourRights.access.content')}
            </li>
            <li>
              <strong>{t('sections.yourRights.delete.label')}：</strong>
              {t('sections.yourRights.delete.content')}
            </li>
            <li>
              <strong>{t('sections.yourRights.withdraw.label')}：</strong>
              {t('sections.yourRights.withdraw.content')}
            </li>
          </ul>

          <h2>{t('sections.policyRevision.title')}</h2>
          <p>{t('sections.policyRevision.description')}</p>

          <h2>{t('sections.contact.title')}</h2>
          <p>{t('sections.contact.description')}</p>
          <ul>
            <li>
              {t('sections.contact.email')}&nbsp;
              <a href="mailto:rabithua@gmail.com">rabithua@gmail.com</a>
            </li>
            <li>
              {t('sections.contact.githubIssues')}&nbsp;
              <a
                href="https://github.com/rabithua/rote/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://github.com/rabithua/rote/issues
              </a>
            </li>
          </ul>
        </article>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
