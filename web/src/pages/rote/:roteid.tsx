import { VerifiedIcon } from '@/components/icons/Verified';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import UserAvatar from '@/components/others/UserAvatar';
import RoteItem from '@/components/rote/roteItem';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';

import type { Rote } from '@/types/main';
import { API_URL, get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { Navigation, RefreshCw, Rss } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

function SingleRotePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.rote' });
  const navigate = useNavigate();
  const { roteid } = useParams();

  const {
    data: rote,
    isLoading,
    error,
    mutate,
    isValidating,
  } = useAPIGet<Rote>(roteid || '', () => get('/notes/' + roteid).then((res) => res.data), {
    onError: (err: any) => {
      // 捕获所有错误情况，包括：
      // 1. 网络错误（后端挂掉、连接超时等）- 没有 response
      // 2. HTTP 错误状态码（404, 500, 502, 503 等）
      // 3. 业务错误（返回的数据格式不正确）
      const hasResponse = err?.response !== undefined;
      const status = err?.response?.status;

      // 如果是网络错误（没有 response）或任何错误状态码（>= 400），都跳转404
      // 这包括：后端挂掉、连接超时、404、500、502、503 等所有错误情况
      if (!hasResponse || (status && status >= 400)) {
        navigate('/404');
      }
    },
  });

  const refreshData = () => {
    if (isLoading || isValidating) {
      return;
    }
    mutate();
  };

  useEffect(() => {
    if (!roteid) {
      navigate('/404');
    }
  }, [roteid, navigate]);

  // 验证返回的数据是否有效
  // 如果数据加载完成但没有有效的笔记信息，也跳转404
  useEffect(() => {
    // 只有在加载完成且没有错误时才验证数据
    // 如果 error 存在，onError 已经处理了跳转，这里不需要再处理
    if (!isLoading && !error) {
      // 验证笔记信息是否有效：至少需要有 id、content 和 author
      // 如果返回的数据不是预期的笔记信息格式，也跳转404
      if (
        !rote ||
        typeof rote !== 'object' ||
        !rote.id ||
        !rote.content ||
        !rote.author ||
        !rote.author.username
      ) {
        navigate('/404');
      }
    }
  }, [isLoading, error, rote, navigate]);

  if (!roteid) {
    return null;
  }

  const SideBar = () =>
    isLoading ? (
      <LoadingPlaceholder className="py-8" size={6} />
    ) : (
      <div className="">
        {rote?.author && (
          <div className="border-b p-4">
            <Link to={`/${rote.author.username}`} className="block">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatar={rote.author.avatar}
                  className="bg-foreground/5 text-primary size-12"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-primary inline-flex items-center gap-1 truncate font-semibold">
                    {rote.author.nickname}
                    {rote.author.emailVerified && (
                      <VerifiedIcon className="text-theme size-4 shrink-0" />
                    )}
                  </div>
                  <div className="text-info truncate text-sm">@{rote.author.username}</div>
                </div>
              </div>
            </Link>
          </div>
        )}
        <div className="grid grid-cols-3 divide-x border-b">
          <a
            href={`${API_URL}/rss/${rote?.author?.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-foreground/3 flex cursor-pointer items-center justify-center gap-2 py-4"
          >
            <Rss className="size-5" />
            <div className="text-xl">RSS</div>
          </a>
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="text-xl">☝️</div>
          </div>
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="text-xl">🤓</div>
          </div>
        </div>
      </div>
    );

  return isLoading ? (
    <LoadingPlaceholder className="py-16" size={6} />
  ) : rote ? (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <Navigation className="size-5" />
          <div className="flex items-center gap-2">{t('sideBarTitle')}</div>
        </div>
      }
      className="pb-16"
    >
      <NavBar onNavClick={refreshData}>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>
      <RoteItem
        showAvatar={false}
        rote={rote}
        mutateSingle={mutate}
        enableContentCollapse={false}
      />
    </ContainerWithSideBar>
  ) : null;
}

export default SingleRotePage;
