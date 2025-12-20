import LanguageSwitcher from '@/components/others/languageSwitcher';
import Logo from '@/components/others/logo';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function SelfhostedGuidePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.selfhosted' });

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
        <article className="prose prose-neutral dark:prose-invert prose-li:break-all prose-code:text-foreground! prose-pre:bg-muted prose-pre:code:text-foreground! w-full overflow-hidden">
          <div className="mb-12">
            <h1 className="mb-4">{t('title')}</h1>
            <p className="text-muted-foreground text-lg">{t('description')}</p>
          </div>
          <h2>{t('quickStart.title')}</h2>
          <p>{t('quickStart.description')}</p>

          <h3>{t('quickStart.method1.title')}</h3>
          <p>{t('quickStart.method1.description')}</p>
          <ol>
            <li>
              <strong>{t('quickStart.method1.steps.prepareConfig.label')}</strong>
              {t('quickStart.method1.steps.prepareConfig.content')}
            </li>
            <li>
              <strong>{t('quickStart.method1.steps.setEnv.label')}</strong>
              {t('quickStart.method1.steps.setEnv.content')}
              <ul>
                <li>
                  {t('quickStart.method1.steps.setEnv.directAccess')}{' '}
                  <code>http://&lt;your-ip-address&gt;:18000</code>
                </li>
                <li>
                  {t('quickStart.method1.steps.setEnv.reverseProxy')}{' '}
                  <code>http://&lt;your-domain&gt;</code> {t('quickStart.method1.steps.setEnv.or')}{' '}
                  <code>https://&lt;your-domain&gt;</code>
                </li>
              </ul>
            </li>
            <li>
              <strong>{t('quickStart.method1.steps.startService.label')}</strong>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                <code className="text-sm">{`${t('quickStart.method1.steps.startService.latestVersion')}
VITE_API_BASE=http://<your-ip-address>:18000 docker-compose up -d

${t('quickStart.method1.steps.startService.specificVersion')}
IMAGE_TAG=v1.0.0 docker-compose up -d`}</code>
              </pre>
            </li>
          </ol>

          <h3>{t('quickStart.method2.title')}</h3>
          <p>{t('quickStart.method2.description')}</p>
          <ol>
            <li>
              <strong>{t('quickStart.method2.steps.accessDokploy.label')}</strong>
              {t('quickStart.method2.steps.accessDokploy.content')}
            </li>
            <li>
              <strong>{t('quickStart.method2.steps.selectTemplate.label')}</strong>
              {t('quickStart.method2.steps.selectTemplate.content')}
            </li>
            <li>
              <strong>{t('quickStart.method2.steps.deployApp.label')}</strong>
              {t('quickStart.method2.steps.deployApp.content')}
            </li>
            <li>
              <strong>{t('quickStart.method2.steps.configureDomain.label')}</strong>
              {t('quickStart.method2.steps.configureDomain.content')}
            </li>
          </ol>

          <h2>{t('configuration.title')}</h2>
          <p>{t('configuration.description')}</p>

          <h3>{t('configuration.required.title')}</h3>
          <ul>
            <li>
              <strong>{t('configuration.required.postgresqlUrl.label')}</strong>
              {t('configuration.required.postgresqlUrl.content')}
            </li>
            <li>
              <strong>{t('configuration.required.viteApiBase.label')}</strong>
              {t('configuration.required.viteApiBase.content')}
            </li>
          </ul>

          <h3>{t('configuration.optional.title')}</h3>
          <ul>
            <li>
              <strong>{t('configuration.optional.postgresPassword.label')}</strong>
              {t('configuration.optional.postgresPassword.content')}
            </li>
            <li>
              <strong>{t('configuration.optional.imageTag.label')}</strong>
              {t('configuration.optional.imageTag.content')}
            </li>
          </ul>

          <h3>{t('configuration.advanced.title')}</h3>
          <p>{t('configuration.advanced.description')}</p>

          <h2>{t('ports.title')}</h2>
          <p>{t('ports.description')}</p>
          <ul>
            <li>
              <strong>{t('ports.backend.label')}</strong>
              {t('ports.backend.content')}
            </li>
            <li>
              <strong>{t('ports.frontend.label')}</strong>
              {t('ports.frontend.content')}
            </li>
            <li>
              <strong>{t('ports.database.label')}</strong>
              {t('ports.database.content')}
            </li>
          </ul>
          <p>{t('ports.modifyNote')}</p>

          <h2>{t('backup.title')}</h2>
          <p>{t('backup.description')}</p>

          <h3>{t('backup.backup.title')}</h3>
          <ol>
            <li>
              <strong>{t('backup.backup.database.label')}</strong>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                <code className="text-sm">{`${t('backup.backup.database.command')}
docker exec rote-postgres pg_dump -U rote rote > rote_backup_$(date +%Y%m%d).sql`}</code>
              </pre>
            </li>
            <li>
              <strong>{t('backup.backup.fileStorage.label')}</strong>
              {t('backup.backup.fileStorage.content')}
            </li>
          </ol>

          <h3>{t('backup.migration.title')}</h3>
          <ol>
            <li>
              <strong>{t('backup.migration.deploy.label')}</strong>
              {t('backup.migration.deploy.content')}
            </li>
            <li>
              <strong>{t('backup.migration.restore.label')}</strong>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                <code className="text-sm">{`${t('backup.migration.restore.command')}
docker exec -i rote-postgres psql -U rote rote < rote_backup_YYYYMMDD.sql`}</code>
              </pre>
            </li>
            <li>
              <strong>{t('backup.migration.fileStorage.label')}</strong>
              {t('backup.migration.fileStorage.content')}
            </li>
          </ol>

          <h2>{t('faq.title')}</h2>

          <h3>{t('faq.serviceNotStart.title')}</h3>
          <ul>
            <li>
              <strong>{t('faq.serviceNotStart.portCheck.label')}</strong>
              {t('faq.serviceNotStart.portCheck.content')}
            </li>
            <li>
              <strong>{t('faq.serviceNotStart.dockerCheck.label')}</strong>
              {t('faq.serviceNotStart.dockerCheck.content')}
            </li>
            <li>
              <strong>{t('faq.serviceNotStart.envCheck.label')}</strong>
              {t('faq.serviceNotStart.envCheck.content')}
            </li>
          </ul>

          <h3>{t('faq.frontendCannotConnect.title')}</h3>
          <ul>
            <li>
              <strong>{t('faq.frontendCannotConnect.viteApiBase.label')}</strong>
              {t('faq.frontendCannotConnect.viteApiBase.content')}
            </li>
            <li>
              <strong>{t('faq.frontendCannotConnect.network.label')}</strong>
              {t('faq.frontendCannotConnect.network.content')}
            </li>
            <li>
              <strong>{t('faq.frontendCannotConnect.firewall.label')}</strong>
              {t('faq.frontendCannotConnect.firewall.content')}
            </li>
          </ul>

          <h3>{t('faq.databaseConnectionFailed.title')}</h3>
          <ul>
            <li>
              <strong>{t('faq.databaseConnectionFailed.container.label')}</strong>
              {t('faq.databaseConnectionFailed.container.content')}
            </li>
            <li>
              <strong>{t('faq.databaseConnectionFailed.connectionString.label')}</strong>
              {t('faq.databaseConnectionFailed.connectionString.content')}
            </li>
            <li>
              <strong>{t('faq.databaseConnectionFailed.wait.label')}</strong>
              {t('faq.databaseConnectionFailed.wait.content')}
            </li>
          </ul>

          <h3>{t('faq.updateVersion.title')}</h3>
          <ol>
            <li>
              <strong>{t('faq.updateVersion.backup.label')}</strong>
              {t('faq.updateVersion.backup.content')}
            </li>
            <li>
              <strong>{t('faq.updateVersion.pull.label')}</strong>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                <code className="text-sm">{`${t('faq.updateVersion.pull.latest')}
docker-compose pull

${t('faq.updateVersion.pull.specific')}
IMAGE_TAG=v1.0.0 docker-compose pull`}</code>
              </pre>
            </li>
            <li>
              <strong>{t('faq.updateVersion.restart.label')}</strong>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4">
                <code className="text-sm">{`docker-compose up -d`}</code>
              </pre>
            </li>
          </ol>

          <h2>{t('help.title')}</h2>
          <p>{t('help.description')}</p>
          <ul>
            <li>
              <strong>{t('help.githubIssues.label')}</strong>
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

export default SelfhostedGuidePage;
