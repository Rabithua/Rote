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

  const { data: tags } = useAPIGet<string[]>('tags', () => get('/users/me/tags').then((res) => res.data));

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

  const location = useLocation();
  const [filter, setFilter] = useState({
    tags: {
      hasEvery: location.state.tags || [],
    },
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
      <div className="bg-opacityLight dark:bg-opacityDark p-4 font-semibold">
        <div className="my-2 flex flex-wrap items-center gap-2">
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
        <div className="my-2 flex max-h-[25vh] flex-wrap items-center gap-2 overflow-y-scroll font-normal text-gray-500">
          {t('allTags')}
          {tags && tags.length > 0
            ? tags.map((tag) => {
                return (
                  <div key={tag} onClick={() => tagsClickHandler(tag)}>
                    <div className="cursor-pointer rounded-md px-2 py-1 text-xs font-normal duration-300 hover:scale-95">
                      {tag}
                    </div>
                  </div>
                );
              })
            : t('none')}
        </div>
      </div>
    );
  }

  function SideBar() {
    return (
      <div className="grid grid-cols-2">
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
          <div className="font-light">SOMETHING</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
          <div className="font-light">SOMETHING</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
          <div className="font-light">SOMETHING</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
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
      <div className={`noScrollBar relative flex-1 overflow-x-hidden overflow-y-visible`}>
        <TagsBlock />

        <RoteList data={data} loadMore={loadMore} mutate={mutate} />
      </div>
    </ContainerWithSideBar>
  );
}

export default MineFilter;
