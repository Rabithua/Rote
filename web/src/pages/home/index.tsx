import slogenImg from '@/assets/img/slogen.svg';
import Heatmap from '@/components/d3/heatmap';
import RoteEditor from '@/components/editor/RoteEditor';
import Logo from '@/components/others/logo';
import SearchBar from '@/components/others/SearchBox';
import TagMap from '@/components/others/tagMap';
import RandomRote from '@/components/rote/randomRote';
import RoteList from '@/components/rote/roteList';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { useEditor } from '@/state/editor';
import type { ApiGetRotesParams, Rotes } from '@/types/main';
import { useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { ChartAreaIcon, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

function MainPageHeader({
  refreshData,
  isLoading,
  isValidating,
}: {
  refreshData: () => void;
  isLoading?: boolean;
  isValidating?: boolean;
}) {
  return (
    <div
      className="group bg-background sticky top-0 z-10 flex cursor-pointer items-center gap-2 p-4 font-light text-gray-600"
      onClick={refreshData}
    >
      <Logo className="h-5 w-auto" color="#07C160" />
      <img
        className="text-theme mb-[2px] ml-2 h-3 opacity-0 duration-300 group-hover:opacity-100"
        src={slogenImg}
        alt="slogen"
      />

      {isLoading ||
        (isValidating && (
          <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
        ))}
    </div>
  );
}

function MainPage() {
  const getPropsMineUnArchived = (
    pageIndex: number,
    _previousPageData: Rotes | null
  ): ApiGetRotesParams | null => ({
    apiType: 'mine',
    params: {
      limit: 20,
      skip: pageIndex * 20,
      archived: false,
    },
  });

  const { data, mutate, loadMore, isLoading, isValidating } = useAPIInfinite(
    getPropsMineUnArchived,
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
      <MainPageHeader refreshData={refreshData} isLoading={isLoading} isValidating={isValidating} />
      <div className="flex gap-4 p-4">
        <RoteEditor
          roteAtom={useEditor().editor_newRoteAtom}
          callback={() => {
            mutate();
          }}
        />
      </div>
      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </>
  );
}

function HomePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.home' });

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

const SideBar = () => {
  const navigate = useNavigate();

  return (
    <>
      <SearchBar
        onSearch={(keyword) => {
          navigate('/filter', {
            state: {
              initialKeyword: keyword.trim(),
            },
          });
        }}
      />
      <Heatmap />
      <TagMap />
      <RandomRote />
    </>
  );
};

export default HomePage;
