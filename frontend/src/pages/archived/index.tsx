import { apiGetMyRote } from '@/api/rote/main';
import Heatmap from '@/components/d3/heatmap';
import NavHeader from '@/components/navHeader';
import RandomRote from '@/components/randomRote';
import RoteList from '@/components/roteList';
import TagMap from '@/components/tagMap';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { Archive, ChartAreaIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function ArchivedPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.archived' });

  const SideBar = () => {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Heatmap />
        <TagMap />
        <RandomRote />
      </div>
    );
  };

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 border-b p-4 text-lg font-semibold">
          <div className="flex h-8 items-center gap-2">
            <ChartAreaIcon className="size-5" />
            {t('statistics')}
          </div>
        </div>
      }
    >
      <NavHeader title={t('title')} icon={<Archive className="size-6" />} />
      <RoteList
        api={apiGetMyRote}
        apiProps={{
          limit: 20,
          archived: true,
        }}
      />
    </ContainerWithSideBar>
  );
}

export default ArchivedPage;
