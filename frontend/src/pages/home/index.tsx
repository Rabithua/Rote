import { apiGetMyRote } from '@/api/rote/main';
import slogenImg from '@/assets/img/slogen.svg';
import Heatmap from '@/components/d3/heatmap';
import Logo from '@/components/logo';
import RandomRote from '@/components/randomRote';
import RoteInputSimple from '@/components/roteInputSimple';
import RoteList from '@/components/roteList';
import TagMap from '@/components/tagMap';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { ChartAreaIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SideBar = () => {
  return (
    <div className='p-4 flex flex-col gap-4'>
      <Heatmap />
      <TagMap />
      <RandomRote />
    </div>
  );
};

function HomePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.home' });

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
      <div className="group sticky top-0 z-10 flex cursor-pointer items-center gap-2 border-b bg-bgLight p-4 py-2 font-light text-gray-600 dark:border-opacityDark dark:bg-bgDark">
        <Logo className="w-24" color="#07C160" />
        <img
          className="mb-[2px] ml-2 h-4 text-green-600 opacity-0 duration-300 group-hover:opacity-100"
          src={slogenImg}
          alt="slogen"
        />
      </div>
      <RoteInputSimple />
      <RoteList
        api={apiGetMyRote}
        apiProps={{
          limit: 20,
          archived: false,
        }}
      />
    </ContainerWithSideBar>
  );
}

export default HomePage;
