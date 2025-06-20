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
import { useTranslation } from 'node_modules/react-i18next';

function ArchivedPage() {
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
      revalidateFirstPage: false,
    }
  );

  const refreshData = () => {
    if (isLoading || isValidating) {
      return;
    }

    mutate();
  };

  const SideBar = () => (
    <>
      <Heatmap />
      <TagMap />
      <RandomRote />
    </>
  );

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <div className="flex h-8 items-center gap-2">
            <ChartAreaIcon className="size-5" />
            {t('statistics')}
          </div>
        </div>
      }
    >
      <NavBar title={t('title')} icon={<Archive className="size-6" />} onNavClick={refreshData}>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>

      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </ContainerWithSideBar>
  );
}

export default ArchivedPage;
