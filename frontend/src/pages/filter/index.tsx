import { StarsBackground } from '@/components/animate-ui/backgrounds/stars';
import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import NavBar from '@/components/navBar';
import RoteList from '@/components/roteList';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet, useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { ActivityIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

function MineFilter() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.filter' });

  const { data: tags } = useAPIGet<string[]>('tags', () =>
    get('/users/me/tags').then((res) => res.data)
  );

  const location = useLocation();
  const [filter, setFilter] = useState({
    tags: {
      hasEvery: location.state.tags || [],
    },
  });

  const getProps = (pageIndex: number, _previousPageData: any): ApiGetRotesParams => {
    return {
      apiType: 'mine',
      params: {
        skip: pageIndex * 20,
        limit: 20,
      },
      filter: filter,
    };
  };

  const { data, mutate, loadMore } = useAPIInfinite(getProps, getRotesV2, {
    initialSize: 0,
    revalidateFirstPage: false,
  });

  function TagsBlock() {
    const tagsClickHandler = (tag: string) => {
      setFilter((prevState) => {
        const newTags = prevState.tags.hasEvery.includes(tag)
          ? prevState.tags.hasEvery.filter((t: any) => t !== tag)
          : [...prevState.tags.hasEvery, tag];

        return {
          ...prevState,
          tags: {
            ...prevState.tags,
            hasEvery: newTags,
          },
        };
      });
    };

    return (
      <div className="relative max-h-[25vh] space-y-4 overflow-y-scroll p-4 pb-0 font-semibold">
        <StarsBackground
          className="absolute inset-0 flex items-center justify-center bg-none!"
          starColor="#07C160"
        />
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {t('includeTags')}
          {filter.tags.hasEvery.length > 0
            ? filter.tags.hasEvery.map((tag: any, index: any) => {
                return (
                  <div
                    className="bg-opacityLight dark:bg-opacityDark cursor-pointer rounded-md px-2 py-1 text-xs font-normal duration-300 hover:scale-95"
                    key={`tag-${index}`}
                    onClick={() => tagsClickHandler(tag)}
                  >
                    {tag}
                  </div>
                );
              })
            : t('none')}
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-2 font-normal text-gray-500">
          {t('allTags')}
          {tags && tags.length > 0
            ? tags.map((tag) => {
                return (
                  <div key={tag} onClick={() => tagsClickHandler(tag)}>
                    <div className="bg-opacityLight dark:bg-opacityDark cursor-pointer rounded-md px-2 py-1 text-xs font-normal duration-300 hover:scale-95">
                      {tag}
                    </div>
                  </div>
                );
              })
            : t('none')}
        </div>
        <div className="from-bgLight dark:via-bgDark/40 via-bgLight/40 sticky bottom-0 z-20 h-8 w-full bg-gradient-to-t to-transparent"></div>
      </div>
    );
  }

  function SideBar() {
    return (
      <div className="grid grid-cols-2">
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <SlidingNumber className="font-mono text-xl font-black" number={tags?.length || 0} />
          <div className="font-light">SOMETHING</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <SlidingNumber className="font-mono text-xl font-black" number={tags?.length || 0} />{' '}
          <div className="font-light">SOMETHING</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <SlidingNumber className="font-mono text-xl font-black" number={tags?.length || 0} />{' '}
          <div className="font-light">SOMETHING</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <SlidingNumber className="font-mono text-xl font-black" number={tags?.length || 0} />{' '}
          <div className="font-light">SOMETHING</div>
        </div>
      </div>
    );
  }

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <div className="flex h-8 items-center gap-2">
            <ActivityIcon className="size-5" />
            {t('data')}
          </div>
        </div>
      }
    >
      <NavBar />
      <TagsBlock />
      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </ContainerWithSideBar>
  );
}

export default MineFilter;
