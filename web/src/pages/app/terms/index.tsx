import LanguageSwitcher from '@/components/others/languageSwitcher';
import Logo from '@/components/others/logo';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function TermsOfServicePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.terms' });

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
        <article className="prose prose-neutral dark:prose-invert prose-li:break-all w-full overflow-hidden">
          <div className="mb-12">
            <h1 className="mb-4">{t('title')}</h1>
            <p className="text-muted-foreground text-lg">{t('effectiveDate')}</p>
          </div>

          <blockquote>{t('welcome')}</blockquote>

          {/* 1. 账户与使用 / Account and Use */}
          <h2>{t('sections.account.title')}</h2>
          <ul>
            <li>
              <strong>{t('sections.account.items.accountCreation.label')} </strong>
              {t('sections.account.items.accountCreation.content')}
            </li>
            <li>
              <strong>{t('sections.account.items.personalUse.label')} </strong>
              {t('sections.account.items.personalUse.content')}
            </li>
            <li>
              <strong>{t('sections.account.items.fees.label')} </strong>
              {t('sections.account.items.fees.content')}
            </li>
          </ul>

          {/* 2. 用户内容与知识产权 / User Content and IP */}
          <h2>{t('sections.content.title')}</h2>
          <ul>
            <li>
              <strong>{t('sections.content.items.ugcOwnership.label')} </strong>
              {t('sections.content.items.ugcOwnership.content')}
            </li>
            <li>
              <strong>{t('sections.content.items.license.label')} </strong>
              {t('sections.content.items.license.content')}
            </li>
            <li>
              <strong>{t('sections.content.items.responsibility.label')} </strong>
              {t('sections.content.items.responsibility.content')}
            </li>
          </ul>

          {/* 3. 行为准则 / Code of Conduct */}
          <h2>{t('sections.conduct.title')}</h2>
          <p>{t('sections.conduct.intro')}</p>
          <ul>
            <li>
              <strong>{t('sections.conduct.items.illegal.label')} </strong>
              {t('sections.conduct.items.illegal.content')}
            </li>
            <li>
              <strong>{t('sections.conduct.items.infringement.label')} </strong>
              {t('sections.conduct.items.infringement.content')}
            </li>
            <li>
              <strong>{t('sections.conduct.items.inappropriate.label')} </strong>
              {t('sections.conduct.items.inappropriate.content')}
            </li>
            <li>
              <strong>{t('sections.conduct.items.abuse.label')} </strong>
              {t('sections.conduct.items.abuse.content')}
            </li>
            <li>
              <strong>{t('sections.conduct.items.harassment.label')} </strong>
              {t('sections.conduct.items.harassment.content')}
            </li>
          </ul>
          <p>{t('sections.conduct.violationHandling')}</p>

          {/* 4. 免责声明与责任限制 / Disclaimers and Limitation of Liability */}
          <h2>{t('sections.disclaimer.title')}</h2>
          <ul>
            <li>
              <strong>{t('sections.disclaimer.items.asIs.label')} </strong>
              {t('sections.disclaimer.items.asIs.content')}
            </li>
            <li>
              <strong>{t('sections.disclaimer.items.interruption.label')} </strong>
              {t('sections.disclaimer.items.interruption.content')}
            </li>
            <li>
              <strong>{t('sections.disclaimer.items.liabilityLimit.label')} </strong>
              {t('sections.disclaimer.items.liabilityLimit.content')}
            </li>
          </ul>

          {/* 5. 协议的修改与终止 / Modification and Termination */}
          <h2>{t('sections.modification.title')}</h2>
          <ul>
            <li>
              <strong>{t('sections.modification.items.modification.label')} </strong>
              {t('sections.modification.items.modification.content')}
            </li>
            <li>
              <strong>{t('sections.modification.items.termination.label')} </strong>
              {t('sections.modification.items.termination.content')}
            </li>
          </ul>

          {/* 6. 争议解决 / Dispute Resolution */}
          <h2>{t('sections.dispute.title')}</h2>
          <p>{t('sections.dispute.content')}</p>

          {/* 7. 联系我们 / Contact */}
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

export default TermsOfServicePage;
