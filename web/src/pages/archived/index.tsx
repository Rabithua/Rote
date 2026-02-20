import Heatmap from '@/components/d3/heatmap';
import NavBar from '@/components/layout/navBar';
import TagMap from '@/components/others/tagMap';
import RandomRote from '@/components/rote/randomRote';
import RoteList from '@/components/rote/roteList';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams, Rotes } from '@/types/main';
import { useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { Archive, ChartAreaIcon, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function MainPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.archived' });

  const getPropsMineArchived = (
    pageIndex: number,
    _previousPageData: Rotes | null
  ): ApiGetRotesParams => ({
    apiType: 'mine',
    params: {
      limit: 20,
      skip: pageIndex * 20,
      archived: true,
    },
  });

  const { data, mutate, loadMore, isLoading, isValidating } = useAPIInfinite(
    getPropsMineArchived,
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
    <>
      <NavBar title={t('title')} icon={<Archive className="size-6" />} onNavClick={refreshData}>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>
      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </>
  );
}

function ArchivedPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.archived' });

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <ChartAreaIcon className="size-5" />
            {t('statistics')}
          </div>
        </div>
      }
    >
      <MainPage />
    </ContainerWithSideBar>
  );
}

const SideBar = () => (
  <>
    <Heatmap />
    <TagMap />
    <RandomRote />
  </>
);

export default ArchivedPage;
