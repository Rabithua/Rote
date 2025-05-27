import slogenImg from '@/assets/img/slogen.svg';
import Heatmap from '@/components/d3/heatmap';
import RoteEditor from '@/components/editor/RoteEditor';
import Logo from '@/components/logo';
import RandomRote from '@/components/randomRote';
import RoteList from '@/components/roteList';
import TagMap from '@/components/tagMap';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { useEditor } from '@/state/editor';
import type { ApiGetRotesParams, Profile, Rotes } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet, useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { Avatar, AvatarFallback, AvatarImage } from '@radix-ui/react-avatar';
import { ChartAreaIcon, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SideBar = () => {
  return (
    <>
      <Heatmap />
      <TagMap />
      <RandomRote />
    </>
  );
};

function HomePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.home' });
  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const getPropsMineUnArchived = (
    pageIndex: number,
    _previousPageData: Rotes
  ): ApiGetRotesParams => {
    return {
      apiType: 'mine',
      params: {
        limit: 20,
        skip: pageIndex * 20,
        archived: false,
      },
    };
  };

  const { data, mutate, loadMore } = useAPIInfinite(getPropsMineUnArchived, getRotesV2, {
    initialSize: 0,
    revalidateFirstPage: false,
  });

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
      <div className="group bg-bgLight dark:bg-bgDark sticky top-0 z-10 flex cursor-pointer items-center gap-2 p-4 py-2 font-light text-gray-600">
        <Logo className="w-24" color="#07C160" />
        <img
          className="mb-[2px] ml-2 h-4 text-green-600 opacity-0 duration-300 group-hover:opacity-100"
          src={slogenImg}
          alt="slogen"
        />
      </div>
      <div className="flex gap-4 p-4">
        <Avatar className="hidden size-10 shrink-0 overflow-hidden rounded-full sm:block">
          {profile?.avatar ? (
            <AvatarImage src={profile.avatar} />
          ) : (
            <AvatarFallback>
              <User className="size-4 text-[#00000010]" />
            </AvatarFallback>
          )}
        </Avatar>
        <RoteEditor
          roteAtom={useEditor().editor_newRoteAtom}
          callback={() => {
            console.log('callback');
            mutate();
          }}
        />
      </div>
      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </ContainerWithSideBar>
  );
}

export default HomePage;
