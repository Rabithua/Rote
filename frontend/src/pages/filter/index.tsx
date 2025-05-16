import { apiGetMyRote, apiGetMyTags } from '@/api/rote/main';
import NavBar from '@/components/navBar';
import RoteList from '@/components/roteList';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { useAPIGet } from '@/utils/fetcher';
import { ActivityIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

function MineFilter() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.filter' });

  const { data: tags } = useAPIGet<string[]>('tags', apiGetMyTags);

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
      <div className="bg-opacityLight p-4 font-semibold dark:bg-opacityDark">
        <div className="my-2 flex flex-wrap items-center gap-2">
          {t('includeTags')}
          {filter.tags.hasEvery.length > 0
            ? filter.tags.hasEvery.map((tag: any, index: any) => {
                return (
                  <div
                    className="cursor-pointer rounded-md bg-opacityLight px-2 py-1 text-xs font-normal duration-300 hover:scale-95 dark:bg-opacityDark"
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
                    <div className="cursor-pointer rounded-md border-[1px] px-2 py-1 text-xs font-normal duration-300 hover:scale-95 dark:border-opacityDark">
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
        <div className="gap2 flex flex-col items-center justify-center border-[0.5px] py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
          <div className="font-light">TAG</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center border-[0.5px] py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
          <div className="font-light">TAG</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center border-[0.5px] py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
          <div className="font-light">TAG</div>
        </div>
        <div className="gap2 flex flex-col items-center justify-center border-[0.5px] py-4">
          <div className="font-mono text-xl font-black">{tags?.length}</div>
          <div className="font-light">TAG</div>
        </div>
      </div>
    );
  }

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 border-b p-4 text-lg font-semibold">
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

        <RoteList
          api={apiGetMyRote}
          apiProps={{
            limit: 20,
            filter,
          }}
        />
      </div>
    </ContainerWithSideBar>
  );
}

export default MineFilter;
