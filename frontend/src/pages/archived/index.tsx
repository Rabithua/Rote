import Heatmap from '@/components/d3/heatmap';
import NavHeader from '@/components/navHeader';
import RandomRote from '@/components/randomRote';
import RoteList from '@/components/roteList';
import TagMap from '@/components/tagMap';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams, Rotes } from '@/types/main';
import { useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { Archive, ChartAreaIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function ArchivedPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.archived' });

  const getPropsMineArchived = (pageIndex: number, _previousPageData: Rotes): ApiGetRotesParams => {
    return {
      apiType: 'mine',
      params: {
        limit: 20,
        skip: pageIndex * 20,
        archived: true,
      },
    };
  };

  const { data, mutate, loadMore } = useAPIInfinite(getPropsMineArchived, getRotesV2, {
    initialSize: 0,
    revalidateFirstPage: false,
  });

  const SideBar = () => {
    return (
      <>
        <Heatmap />
        <TagMap />
        <RandomRote />
      </>
    );
  };

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
      <NavHeader title={t('title')} icon={<Archive className="size-6" />} />
      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </ContainerWithSideBar>
  );
}

export default ArchivedPage;
