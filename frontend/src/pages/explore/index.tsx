import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavHeader from '@/components/navHeader';
import RandomCat from '@/components/RandomCat';
import RoteList from '@/components/roteList';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { getPropsPublic } from '@/utils/fetcher';
import { formatTimeAgo } from '@/utils/main';
import { Eye, GitFork, Github, Globe2, MessageCircleQuestionIcon, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ExplorePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.explore' });

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
            <div className="text-sm font-thin">Rote 已在 Github 开源，欢迎 Star!</div>
            <div className="grid w-4/5 grid-cols-2 justify-between gap-2">
              {dataRender.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  {item.icon}
                  <div className="text-sm">
                    {roteGithubData[item.key]} {item.title}
                  </div>
                </div>
              ))}
            </div>
            <div className="">上次推送时间：{formatTimeAgo(roteGithubData.pushed_at)}</div>
          </Link>
        )}

        <div className="flex flex-col">
          <div className="p-4 pb-0 font-semibold">
            EveDayOneCat <br />
            <div className="text-sm font-normal text-gray-500">
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
          <div className="flex h-8 items-center gap-2">
            <Github className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <NavHeader title={t('title')} icon={<Globe2 className="size-6" />} />
      <RoteList getProps={getPropsPublic} />
    </ContainerWithSideBar>
  );
}

export default ExplorePage;
