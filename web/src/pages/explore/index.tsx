import { AppleIcon } from '@/components/icons/Apple';
import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import RandomCat from '@/components/others/RandomCat';
import RoteList from '@/components/rote/roteList';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams, Rotes } from '@/types/main';
import { useAPIInfinite } from '@/utils/fetcher';
import { formatTimeAgo } from '@/utils/main';
import { getRotesV2 } from '@/utils/roteApi';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Eye,
  GitFork,
  Github,
  Globe2,
  MessageCircleQuestionIcon,
  MonitorPlay,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatGithubCount(value: unknown) {
  const count = Number(value) || 0;
  if (count < 1000) {
    return { number: count, suffix: '', decimalPlaces: 0 };
  }

  const divisor = count < 1_000_000 ? 1000 : 1_000_000;
  const suffix = count < 1_000_000 ? 'k' : 'm';
  const compactNumber = count / divisor;
  const decimalPlaces = compactNumber < 10 && count % divisor !== 0 ? 1 : 0;

  return { number: compactNumber, suffix, decimalPlaces };
}

const communityProjects = [
  {
    key: 'roteSkill',
    href: 'https://github.com/Rabithua/rote-skill',
  },
  {
    key: 'rotefeeder',
    href: 'https://github.com/Rabithua/Rotefeeder',
  },
  {
    key: 'roteToolkit',
    href: 'https://github.com/Rabithua/rote-toolkit',
  },
  {
    key: 'rerote',
    href: 'https://github.com/Rabithua/Rerote',
  },
  {
    key: 'raycast',
    href: 'https://github.com/aBER0724/rote-raycast',
  },
] as const;

function ExplorePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.explore' });

  const getPropsPublic = (
    pageIndex: number,
    _previousPageData: Rotes | null
  ): ApiGetRotesParams | null => ({
    apiType: 'public',
    params: {
      limit: 20,
      skip: pageIndex * 20,
    },
  });

  const { data, mutate, loadMore, isLoading, isValidating } = useAPIInfinite(
    getPropsPublic,
    getRotesV2,
    {
      initialSize: 0,
      revalidateOnMount: true,
    }
  );

  const refreshData = () => {
    if (isLoading || isValidating) {
      return;
    }
    mutate();
  };

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Github className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <NavBar title={t('title')} icon={<Globe2 className="size-5" />} onNavClick={refreshData}>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>
      <Announcement />
      <RoteList
        data={data}
        loadMore={loadMore}
        mutate={mutate}
        isValidating={isValidating}
        showAuthorActions
      />
    </ContainerWithSideBar>
  );
}

const SideBar = () => {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.explore' });
  const { data: roteGithubData, isLoading: isRoteGithubDataLoading } = useSWR(
    'https://api.github.com/repos/rabithua/rote',
    fetcher
  );
  const isDemoSite = typeof window !== 'undefined' && window.location.hostname === 'demo.rote.ink';

  const dataRender = [
    {
      key: 'stargazers_count',
      icon: <Star className="size-4 shrink-0" />,
      title: t('star'),
    },
    {
      key: 'forks_count',
      icon: <GitFork className="size-4 shrink-0" />,
      title: t('fork'),
    },
    {
      key: 'open_issues_count',
      icon: <MessageCircleQuestionIcon className="size-4 shrink-0" />,
      title: t('issues'),
    },
    {
      key: 'watchers_count',
      icon: <Eye className="size-4 shrink-0" />,
      title: t('watch'),
    },
  ];

  return (
    <div className="flex w-full flex-col divide-y">
      {isRoteGithubDataLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : (
        <Link
          target="_blank"
          to={roteGithubData.html_url}
          className="flex flex-col gap-2 px-4 py-2"
        >
          <div className="text-sm font-light">{t('githubOpenSource')}</div>
          <div className="grid w-4/5 grid-cols-2 justify-between gap-2">
            {dataRender.map((item) => {
              const count = formatGithubCount(roteGithubData[item.key]);

              return (
                <div key={item.key} className="flex min-w-0 items-center gap-2">
                  {item.icon}
                  <div className="flex min-w-0 items-center gap-1 text-sm">
                    <span className="inline-flex whitespace-nowrap tabular-nums">
                      <SlidingNumber
                        className="inline-flex"
                        number={count.number}
                        decimalPlaces={count.decimalPlaces}
                      />
                      {count.suffix}
                    </span>
                    <span className="min-w-0 truncate">{item.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-info text-xs">
            {t('lastPushTime')}
            {formatTimeAgo(roteGithubData.pushed_at)}
          </div>
        </Link>
      )}

      <div className="divide-border/50 flex flex-col divide-y">
        <div className="px-4 py-2">
          <div className="text-md">{t('supportAndDocs.title')}</div>
          <div className="text-info line-clamp-2 text-xs font-light">
            {t('supportAndDocs.subtitle')}
          </div>
        </div>

        <div className="grid w-4/5 grid-cols-2 gap-2 px-4 py-2">
          <Link
            to="/doc/selfhosted"
            title={t('supportAndDocs.selfHosted')}
            className="hover:text-info flex min-w-0 items-center gap-2 text-sm duration-200 hover:opacity-60"
          >
            <BookOpen className="size-4 shrink-0" />
            <div className="min-w-0 truncate">{t('supportAndDocs.selfHosted')}</div>
          </Link>

          <a
            href="https://github.com/rabithua/rote/issues"
            target="_blank"
            rel="noopener noreferrer"
            title={t('supportAndDocs.githubIssues')}
            className="hover:text-info flex min-w-0 items-center gap-2 text-sm duration-200 hover:opacity-60"
          >
            <Github className="size-4 shrink-0" />
            <div className="min-w-0 truncate">{t('supportAndDocs.githubIssues')}</div>
          </a>

          <a
            href="https://apps.apple.com/app/rote/id6755513897"
            target="_blank"
            rel="noopener noreferrer"
            title={t('supportAndDocs.iosApp')}
            className="hover:text-info flex min-w-0 items-center gap-2 text-sm duration-200 hover:opacity-60"
          >
            <AppleIcon className="size-4 shrink-0" />
            <div className="min-w-0 truncate">{t('supportAndDocs.iosApp')}</div>
          </a>

          {!isDemoSite && (
            <a
              href="https://demo.rote.ink/login"
              target="_blank"
              rel="noopener noreferrer"
              title={t('supportAndDocs.tryDemo')}
              className="hover:text-info flex min-w-0 items-center gap-2 text-sm duration-200 hover:opacity-60"
            >
              <MonitorPlay className="size-4 shrink-0" />
              <div className="min-w-0 truncate">{t('supportAndDocs.tryDemo')}</div>
            </a>
          )}
        </div>
      </div>

      <div className="divide-border/50 flex flex-col divide-y">
        <div className="px-4 py-2">
          <div className="text-md">{t('communityProjects.title')}</div>
          <div className="text-info text-xs font-light">{t('communityProjects.subtitle')}</div>
        </div>

        <div className="grid w-4/5 gap-2 px-4 py-2">
          {communityProjects.map((project) => (
            <a
              key={project.key}
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-info group flex min-w-0 items-start gap-2 text-sm duration-200 hover:opacity-60"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="min-w-0 truncate"
                    title={t(`communityProjects.items.${project.key}.title`)}
                  >
                    {t(`communityProjects.items.${project.key}.title`)}
                  </div>
                  <ArrowUpRight className="text-info size-4 shrink-0 opacity-0 duration-200 group-hover:opacity-100" />
                </div>
                <div className="text-info line-clamp-1 text-xs font-light">
                  {t(`communityProjects.items.${project.key}.description`)}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="p-4 pb-0 font-semibold">
          EveDayOneCat <br />
          <div className="text-info text-sm font-normal">
            <Link to={'http://motions.cat/index.html'} target="_blank">
              From: http://motions.cat/index.html
            </Link>
          </div>
        </div>
        <RandomCat />
        <div className="mx-4">Click img to random one cat.</div>
      </div>
    </div>
  );
};

const Announcement = () => {
  const { data: siteStatus } = useSiteStatus();
  const announcement = siteStatus?.site?.announcement;

  if (!announcement?.enabled || !announcement?.content) {
    return null;
  }

  const content = (
    <div
      className={`animate-show bg-foreground/2 block px-4 py-4 text-sm font-light duration-300 ${announcement.link ? 'hover:underline' : ''}`}
    >
      <Activity className="mr-2 inline size-3" />
      <div className="inline">{announcement.content}</div>
      {announcement.link && <ArrowUpRight className="ml-1 inline size-3" />}
    </div>
  );

  if (announcement.link) {
    return (
      <Link to={announcement.link} target="_blank">
        {content}
      </Link>
    );
  }

  return content;
};

export default ExplorePage;
