import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import RandomCat from '@/components/others/RandomCat';
import RoteList from '@/components/rote/roteList';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams, Rotes } from '@/types/main';
import { useAPIInfinite } from '@/utils/fetcher';
import { formatTimeAgo } from '@/utils/main';
import { getRotesV2 } from '@/utils/roteApi';
import {
  Eye,
  GitFork,
  Github,
  Globe2,
  MessageCircleQuestionIcon,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
      revalidateFirstPage: false,
    }
  );

  const refreshData = () => {
    if (isLoading || isValidating) {
      return;
    }
    mutate();
  };

  const SideBar = () => {
    const { data: roteGithubData, isLoading: isRoteGithubDataLoading } = useSWR(
      'https://api.github.com/repos/rabithua/rote',
      fetcher
    );

    const dataRender = [
      {
        key: 'stargazers_count',
        icon: <Star className="size-4" />,
        title: t('star'),
      },
      {
        key: 'forks_count',
        icon: <GitFork className="size-4" />,
        title: t('fork'),
      },
      {
        key: 'open_issues_count',
        icon: <MessageCircleQuestionIcon className="size-4" />,
        title: t('issues'),
      },
      {
        key: 'watchers_count',
        icon: <Eye className="size-4" />,
        title: t('watch'),
      },
    ];

    return (
      <div className="flex w-full flex-col divide-y-1">
        {isRoteGithubDataLoading ? (
          <LoadingPlaceholder className="py-8" size={6} />
        ) : (
          <Link target="_blank" to={roteGithubData.html_url} className="flex flex-col gap-2 p-4">
            <div className="text-sm font-thin">{t('githubOpenSource')}</div>
            <div className="grid w-4/5 grid-cols-2 justify-between gap-2">
              {dataRender.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  {item.icon}
                  <div className="flex items-center gap-1 text-sm">
                    <SlidingNumber number={roteGithubData[item.key]} /> {item.title}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-info text-xs">
              {t('lastPushTime')}
              {formatTimeAgo(roteGithubData.pushed_at)}
            </div>
          </Link>
        )}

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

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Github className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <NavBar title={t('title')} icon={<Globe2 className="size-6" />} onNavClick={refreshData}>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>
      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </ContainerWithSideBar>
  );
}

export default ExplorePage;
