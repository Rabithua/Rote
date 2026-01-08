import { useSiteStatus } from '@/hooks/useSiteStatus';
import { buildAbsoluteUrl, getBaseUrl } from '@/utils/meta';
import { Helmet } from '@dr.pogodin/react-helmet';
import React from 'react';

type PageMetaProps = {
  /** 页面级标题（不带站点名，组件内部会自动拼接；不传则不覆盖全局标题） */
  title?: string;
  /** 页面描述，不传则不覆盖全局描述 */
  description?: string;
  /** 页面路径（可选，不传则使用 AppHelmet 中动态获取的当前路径） */
  path?: string;
  /** Open Graph 类型，默认 website */
  ogType?: 'website' | 'article' | 'profile';
  /** 分享图路径或绝对 URL，不传则使用站点 logo */
  imagePath?: string;
  /** robots，如 `noindex, nofollow` */
  robots?: string;
  /** 额外的 meta / link 标签（如 article:author 等） */
  extraMeta?: React.ReactNode;
};

export function PageMeta({
  title,
  description,
  path,
  ogType = 'website',
  imagePath = '/logo.png',
  robots,
  extraMeta,
}: PageMetaProps) {
  const { data: siteStatus } = useSiteStatus();
  const baseUrl = getBaseUrl(siteStatus);
  const siteName = siteStatus?.site?.name || 'Rote';

  // 不传 title/description 时，不覆盖全局设置（AppHelmet）
  // 如果传了 description 且有内容，则设置以覆盖 AppHelmet
  const fullTitle = title && title.trim() ? `${title.trim()} - ${siteName}` : undefined;
  // 如果 description 是 undefined 或空字符串，则不设置；如果有内容，则设置以覆盖全局
  const desc = description && description.trim() ? description.trim() : undefined;

  // 如果传了 path，则覆盖 canonical 和 og:url；否则由 AppHelmet 处理
  const url = path && path.trim() ? buildAbsoluteUrl(path.trim(), baseUrl) : undefined;

  // 构建图片 URL
  // 如果 imagePath 已经是绝对 URL，直接使用
  // 否则使用 buildAbsoluteUrl 构建（确保正确处理相对路径和 baseUrl）
  const imageUrl =
    imagePath && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))
      ? imagePath
      : buildAbsoluteUrl(imagePath || '/logo.png', baseUrl);

  return (
    <Helmet>
      {fullTitle ? <title>{fullTitle}</title> : null}
      {/* 确保 description 能覆盖 AppHelmet 的设置 */}
      {desc ? <meta name="description" content={desc} /> : null}
      {url ? <link rel="canonical" href={url} /> : null}

      {/* Open Graph 基础信息 */}
      <meta property="og:type" content={ogType} />
      {fullTitle ? <meta property="og:title" content={fullTitle} /> : null}
      {/* 确保 og:description 与 description 一致 */}
      {desc ? <meta property="og:description" content={desc} /> : null}
      {url ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={imageUrl} />

      {/* Twitter Card 基础信息 */}
      <meta
        name="twitter:card"
        content={ogType === 'article' ? 'summary_large_image' : 'summary'}
      />
      {fullTitle ? <meta name="twitter:title" content={fullTitle} /> : null}
      {/* 确保 twitter:description 与 description 一致 */}
      {desc ? <meta name="twitter:description" content={desc} /> : null}
      <meta name="twitter:image" content={imageUrl} />

      {robots && robots.trim() ? <meta name="robots" content={robots.trim()} /> : null}

      {extraMeta && React.isValidElement(extraMeta) ? extraMeta : null}
    </Helmet>
  );
}
