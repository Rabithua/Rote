import { StarsBackground } from '@/components/animate-ui/backgrounds/stars';
import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavBar from '@/components/navBar';
import RoteList from '@/components/roteList';
import { Input } from '@/components/ui/input';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams, Statistics } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet, useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { ActivityIcon, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

function SideBar() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.filter' });
  const { isLoading, data: statisticsData } = useAPIGet<Statistics>('statistics', () =>
    get('/users/me/statistics').then((res) => res.data)
  );

  return isLoading ? (
    <LoadingPlaceholder className="py-8" size={6} />
  ) : (
    <div className="grid grid-cols-2 divide-x-1 border-b">
      <div className="gap2 flex flex-col items-center justify-center py-4">
        <SlidingNumber
          className="font-mono text-xl font-black"
          number={statisticsData?.noteCount || 0}
        />
        <div className="font-light">{t('note')}</div>
      </div>
      <div className="gap2 flex flex-col items-center justify-center py-4">
        <SlidingNumber
          className="font-mono text-xl font-black"
          number={statisticsData?.attachmentsCount || 0}
        />
        <div className="font-light">{t('attachment')}</div>
      </div>
    </div>
  );
}

function MineFilter() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.filter' });

  const { data: tags } = useAPIGet<string[]>('tags', () =>
    get('/users/me/tags').then((res) => res.data)
  );

  const location = useLocation();
  const initialKeyword = location.state?.initialKeyword || '';

  const [filter, setFilter] = useState({
    tags: {
      hasEvery: location.state?.tags || [],
    },
    keyword: initialKeyword,
  });

  // 用于存储实际搜索的关键词
  const [searchKeyword, setSearchKeyword] = useState(initialKeyword);

  // 搜索处理函数
  const handleSearch = useCallback(() => {
    setSearchKeyword(filter.keyword);
  }, [filter.keyword]);

  // 构建API参数，使用实际搜索关键词
  const getProps = useCallback(
    (pageIndex: number, _previousPageData: any): ApiGetRotesParams => {
      const params: any = {
        skip: pageIndex * 20,
        limit: 20,
      };

      if (filter.tags.hasEvery.length > 0) {
        params.tag = filter.tags.hasEvery;
      }

      if (searchKeyword.trim()) {
        params.keyword = searchKeyword.trim();
      }

      return {
        apiType: 'mine',
        params,
      };
    },
    [filter.tags.hasEvery, searchKeyword]
  );

  const { data, mutate, loadMore } = useAPIInfinite(getProps, getRotesV2, {
    initialSize: 1,
    revalidateFirstPage: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const SearchBox = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <Input
          placeholder={t('searchPlaceholder')}
          className="inputOrTextAreaInit focus:bg-opacityLight dark:focus:bg-opacityDark px-4"
          value={filter.keyword}
          onChange={(e) => {
            setFilter((prevState) => ({
              ...prevState,
              keyword: e.target.value,
            }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
        />
        <Search
          className="hover:bg-opacityLight dark:hover:bg-opacityDark size-10 shrink-0 p-3"
          onClick={handleSearch}
        />
      </div>
    ),
    [t, filter.keyword, handleSearch]
  );

  const tagsClickHandler = useCallback((tag: string) => {
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
  }, []);

  const TagsBlock = useMemo(
    () => (
      <StarsBackground
        pointerEvents={false}
        starColor="#07C160"
        className="relative max-h-[25vh] overflow-hidden bg-none"
      >
        <div className="relative max-h-[25vh] space-y-4 overflow-y-scroll bg-none p-4 pb-0 font-semibold">
          <div className="relative flex flex-wrap items-center gap-2">
            {t('includeTags')}
            {filter.tags.hasEvery.length > 0
              ? filter.tags.hasEvery.map((tag: any, index: any) => (
                  <div
                    className="bg-opacityLight dark:bg-opacityDark cursor-pointer rounded-md px-2 py-1 text-xs font-normal duration-300 hover:scale-95"
                    key={`tag-${index}`}
                    onClick={() => tagsClickHandler(tag)}
                  >
                    {tag}
                  </div>
                ))
              : t('none')}
          </div>
          <div className="relative flex flex-wrap items-center gap-2 font-normal text-gray-500">
            {t('allTags')}
            {tags && tags.length > 0
              ? tags.map((tag) => (
                  <div key={tag} onClick={() => tagsClickHandler(tag)}>
                    <div className="bg-opacityLight dark:bg-opacityDark cursor-pointer rounded-md px-2 py-1 text-xs font-normal duration-300 hover:scale-95">
                      {tag}
                    </div>
                  </div>
                ))
              : t('none')}
          </div>
          <div className="from-bgLight dark:from-bgDark dark:via-bgDark/40 via-bgLight/40 sticky bottom-0 z-1 h-8 w-full bg-gradient-to-t to-transparent"></div>
        </div>
      </StarsBackground>
    ),
    [t, filter.tags.hasEvery, tags, tagsClickHandler]
  );

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
      {SearchBox}
      {TagsBlock}
      <RoteList data={data} loadMore={loadMore} mutate={mutate} />
    </ContainerWithSideBar>
  );
}

export default MineFilter;
