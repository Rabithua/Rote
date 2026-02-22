import { StarsBackground } from '@/components/animate-ui/backgrounds/stars';
import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import SearchBar from '@/components/others/SearchBox';
import RoteList from '@/components/rote/roteList';
import { DatePicker } from '@/components/ui/date-picker';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { loadTagsAtom, tagsAtom } from '@/state/tags';
import type { ApiGetRotesParams, Statistics } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet, useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { format } from 'date-fns';
import { useAtomValue, useSetAtom } from 'jotai';
import { ActivityIcon, Filter, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

function SideBar() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.filter' });
  const { isLoading, data: statisticsData } = useAPIGet<Statistics>('statistics', () =>
    get('/users/me/statistics').then((res) => res.data)
  );

  return isLoading ? (
    <LoadingPlaceholder className="py-8" size={6} />
  ) : (
    <div className="grid grid-cols-2 divide-x border-b">
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

  const tags = useAtomValue(tagsAtom);
  const loadTags = useSetAtom(loadTagsAtom);
  useEffect(() => {
    if (tags === null) loadTags();
  }, [tags, loadTags]);

  const location = useLocation();

  const [filter, setFilter] = useState({
    tags: {
      hasEvery: location.state?.tags || [],
    },
    keyword: location.state?.initialKeyword || '',
    date: location.state?.date || '',
  });

  const getProps = useCallback(
    (pageIndex: number, _previousPageData: any): ApiGetRotesParams => {
      const params: any = {
        skip: pageIndex * 20,
        limit: 20,
      };

      if (filter.tags.hasEvery.length > 0) {
        params.tag = filter.tags.hasEvery;
      }

      if (filter.keyword.trim()) {
        params.keyword = filter.keyword.trim();
      }

      if (filter.date) {
        params.date = filter.date;
      }

      return {
        apiType: 'mine',
        params,
      };
    },
    [filter.tags.hasEvery, filter.keyword, filter.date]
  );

  const { data, mutate, loadMore, isLoading, isValidating, error, setSize } = useAPIInfinite(
    getProps,
    getRotesV2,
    {
      initialSize: 1,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // 当 filter 变化时，重置分页并重新验证
  const prevFilterRef = useRef<{ tags: string[]; keyword: string; date: string } | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // 跳过初始挂载
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevFilterRef.current = {
        tags: filter.tags.hasEvery,
        keyword: filter.keyword,
        date: filter.date,
      };
      return;
    }

    const currentTags = filter.tags.hasEvery;
    const currentKeyword = filter.keyword;
    const currentDate = filter.date;
    const prevFilter = prevFilterRef.current;

    if (!prevFilter) {
      prevFilterRef.current = {
        tags: currentTags,
        keyword: currentKeyword,
        date: currentDate,
      };
      return;
    }

    // 检查是否真的发生了变化
    const tagsChanged =
      currentTags.length !== prevFilter.tags.length ||
      currentTags.some((tag: string, index: number) => tag !== prevFilter.tags[index]);
    const keywordChanged = currentKeyword !== prevFilter.keyword;
    const dateChanged = currentDate !== prevFilter.date;

    if (tagsChanged || keywordChanged || dateChanged) {
      // 更新引用
      prevFilterRef.current = {
        tags: currentTags,
        keyword: currentKeyword,
        date: currentDate,
      };
      // 重置到第一页并重新验证
      setSize(1);
      mutate();
    }
  }, [filter.tags.hasEvery, filter.keyword, filter.date, setSize, mutate]);

  // 处理错误提示
  useEffect(() => {
    if (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        t('searchError', { defaultValue: '搜索失败，请稍后重试' });
      toast.error(errorMessage);
    }
  }, [error, t]);

  const refreshData = () => {
    if (isLoading || isValidating) {
      return;
    }
    mutate();
  };

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
        className="relative h-auto max-h-[25vh] overflow-hidden bg-none"
      >
        <div className="noScrollBar relative max-h-[25vh] space-y-4 overflow-y-scroll bg-none mask-[linear-gradient(180deg,#000000_calc(100%-20%),transparent)] p-4 font-semibold">
          <div className="relative flex flex-wrap items-center gap-2">
            {t('includeTags')}
            {filter.tags.hasEvery.length > 0
              ? filter.tags.hasEvery.map((tag: any, index: any) => (
                  <div
                    className="bg-foreground/5 cursor-pointer rounded-md px-2 py-1 text-xs font-normal duration-300 hover:scale-95"
                    key={`tag-${index}`}
                    onClick={() => tagsClickHandler(tag)}
                  >
                    {tag}
                  </div>
                ))
              : t('none')}
          </div>
          <div className="text-info relative flex flex-wrap items-center gap-2 font-normal">
            {t('allTags')}
            {tags && tags.length > 0
              ? tags.map((tag) => (
                  <div key={tag.name} onClick={() => tagsClickHandler(tag.name)}>
                    <div className="bg-foreground/6 cursor-pointer rounded-md px-2 py-1 text-xs font-normal duration-300 hover:scale-95">
                      {tag.name}{' '}
                      {tag.count > 0 && <span className="ml-1 opacity-50">{tag.count}</span>}
                    </div>
                  </div>
                ))
              : t('none')}
          </div>
        </div>
      </StarsBackground>
    ),
    [t, filter.tags.hasEvery, tags, tagsClickHandler]
  );

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <ActivityIcon className="size-5" />
            {t('data')}
          </div>
        </div>
      }
    >
      <NavBar title={t('title')} icon={<Filter className="size-5" />} onNavClick={refreshData}>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>

      <div className="flex w-full items-center divide-x">
        <SearchBar
          className="flex-1"
          defaultValue={filter.keyword}
          onSearch={(keyword) => {
            const trimmedKeyword = keyword.trim();
            setFilter((prevState) => ({
              ...prevState,
              keyword: trimmedKeyword,
            }));
          }}
          isLoading={isLoading || isValidating}
        />
        <DatePicker
          date={filter.date ? new Date(filter.date) : undefined}
          className="rounded-none border-none bg-none"
          setDate={(date) => {
            setFilter((prev) => ({
              ...prev,
              date: date ? format(date, 'yyyy-MM-dd') : '',
            }));
          }}
        />
      </div>
      {TagsBlock}
      <RoteList data={data} loadMore={loadMore} mutate={mutate} error={error} />
    </ContainerWithSideBar>
  );
}

export default MineFilter;
