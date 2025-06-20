import { SlidingNumber } from '@/components/animate-ui/text/sliding-number';
import LanguageSwitcher from '@/components/others/languageSwitcher';
import Logo from '@/components/others/logo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Profile } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { formatTimeAgo } from '@/utils/main';
import {
  ArrowRight,
  BookOpen,
  Code,
  Eye,
  GitFork,
  Github,
  Globe2,
  Lightbulb,
  MessageCircleQuestionIcon,
  Shield,
  Sparkles,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useSWR from 'swr';

function Landing() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.landing' });

  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const { data: roteGithubData, isLoading: isRoteGithubDataLoading } = useSWR(
    'https://api.github.com/repos/rabithua/rote',
    (url: string) => fetch(url).then((res) => res.json())
  );

  // 根据最后推送时间获取颜色类
  const getTimeColor = (pushedAt: string) => {
    const now = new Date();
    const pushDate = new Date(pushedAt);
    const diffInDays = Math.floor((now.getTime() - pushDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays <= 7) {
      return 'text-green-600'; // 一周内 - 绿色
    } else if (diffInDays <= 30) {
      return 'text-yellow-600'; // 一个月内 - 黄色
    } else if (diffInDays <= 365) {
      return 'text-orange-600'; // 一年内 - 橙色
    } else {
      return 'text-red-600'; // 超过一年 - 红色
    }
  };
  const dataRender = [
    {
      key: 'stargazers_count',
      icon: <Star className="size-4" />,
      title: t('star'),
    },
    {
      key: 'forks_count',
      icon: <GitFork className="size-4" />,
      title: t('fork'),
    },
    {
      key: 'open_issues_count',
      icon: <MessageCircleQuestionIcon className="size-4" />,
      title: t('issues'),
    },
    {
      key: 'watchers_count',
      icon: <Eye className="size-4" />,
      title: t('watch'),
    },
  ];

  const features = [
    {
      icon: BookOpen,
      title: t('coreFeatures.features.restraint.title'),
      description: t('coreFeatures.features.restraint.description'),
    },
    {
      icon: Sparkles,
      title: t('coreFeatures.features.simple.title'),
      description: t('coreFeatures.features.simple.description'),
    },
    {
      icon: Code,
      title: t('coreFeatures.features.openApi.title'),
      description: t('coreFeatures.features.openApi.description'),
    },
    {
      icon: Shield,
      title: t('coreFeatures.features.freedom.title'),
      description: t('coreFeatures.features.freedom.description'),
    },
  ];

  const quickLinks = [
    {
      name: 'Github',
      href: 'https://github.com/Rabithua/Rote',
      icon: Github,
      external: true,
    },
    {
      name: 'Explore Rote',
      href: '/explore',
      icon: Globe2,
      external: false,
    },
    {
      name: 'Rabithua',
      href: '/rabithua',
      icon: Lightbulb,
      external: false,
    },
  ];

  return (
    <div className="bg-pattern min-h-dvh divide-y font-sans">
      {/* Logo and Title - 更优雅的层次 */}
      <div className="bg-background/90 sticky top-0 z-10 w-full px-6 py-4 backdrop-blur-md">
        <div className="flex w-full items-end gap-4">
          <div className="flex shrink-0 justify-center">
            <Logo className="h-6 w-auto opacity-90" color="#07C160" />
          </div>

          {/* 诗句 - 更小更低调 */}
          <div className="flex min-w-0 flex-1 gap-2">
            <span className="text-info truncate text-sm font-light tracking-wide" title={t('poem')}>
              {t('poem')}
            </span>
          </div>

          <LanguageSwitcher className="ml-auto shrink-0" />
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-background relative space-y-6 divide-y-[0.5px] border-r border-l py-20 sm:mx-4">
        {/* Main heading - 更克制的设计 */}
        <div className="space-y-2 divide-y-[0.5px] px-2">
          <h1 className="text-foreground text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('slogen')}
          </h1>

          {/* 副标题 - 更清晰的层次 */}
          <p className="text-info pb-3 text-xl leading-relaxed font-light">
            {t('openApi')} · {t('data')}
          </p>
        </div>

        {/* Type tags - 更简洁的设计 */}
        {/* <div className="mb-12 px-2">
          <div className="bg-muted/30 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border px-4 py-2">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i}>
                <span className="text-info text-sm font-light">{t(`types.${i}`)}</span>
                {i < 4 && <span className="text-info/50 mx-1.5">·</span>}
              </span>
            ))}
          </div>
        </div> */}

        {/* CTA Buttons - 更优雅的按钮设计 */}
        <div className="flex flex-row gap-3 px-2">
          <Button asChild size="lg">
            <Link
              className="text-background hover:text-background"
              to={profile ? '/home' : '/login'}
            >
              {profile ? t('dashboard') : t('linksItems.0')}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>

          <Button
            variant="outline"
            size="lg"
            asChild
            className="border-muted-foreground/20 hover:bg-muted/50"
          >
            <Link to="https://github.com/Rabithua/Rote" target="_blank">
              <Github className="mr-2 size-4" />
              {t('linksItems.2')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-background divide-y border-x-1 sm:mx-4">
        <div className="space-y-2 divide-y-[0.5px] p-2">
          <p className="text-theme/20 pb-2 font-mono text-xs font-light uppercase">
            {t('coreFeatures.tagline')}
          </p>
          <h2 className="text-3xl font-bold">{t('coreFeatures.title')}</h2>
          <p className="text-info text-lg font-light">{t('coreFeatures.subtitle')}</p>
        </div>

        <div className="gap-6 p-2 md:grid md:grid-cols-2">
          {features.map((feature, index) => (
            <div key={index}>
              <div className="hover:bg-accent/5 group flex flex-row items-start gap-6 py-8 transition-all duration-300">
                {/* Icon */}
                <div className="border-theme flex size-16 shrink-0 items-center justify-center rounded-md border-[0.5px] border-dashed bg-[#07C160]/10 transition-all duration-300 group-hover:bg-[#07C160]/20">
                  <feature.icon className="size-8 text-[#07C160]" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-info leading-relaxed font-light">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-background divide-y border-x-1 sm:mx-4">
        <div className="space-y-2 divide-y-[0.5px] p-2">
          <p className="text-theme/20 pb-2 font-mono text-xs font-light uppercase">
            {t('construction.tagline')}
          </p>
          <h2 className="text-3xl font-bold">{t('construction.title')}</h2>
          <p className="text-info text-lg font-light">{t('construction.subtitle')}</p>
        </div>
        {isRoteGithubDataLoading ? (
          <div className="flex flex-col gap-2 p-2">
            {/* 骨架屏 - 模拟 GitHub 数据展示 */}
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 divide-y-[0.5px] p-2">
            <div className="flex gap-2 pb-2 text-sm font-thin">
              {dataRender.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  {item.icon}
                  <div className="flex items-center gap-1 text-sm">
                    <SlidingNumber number={roteGithubData[item.key]} /> {item.title}
                  </div>
                </div>
              ))}
            </div>
            <div className={`text-xs opacity-40 ${getTimeColor(roteGithubData.pushed_at)}`}>
              {t('lastPushTime')}
              {formatTimeAgo(roteGithubData.pushed_at)}
            </div>
          </div>
        )}
      </div>

      {/* Quick Links Section */}
      <div className="bg-background/80 divide-y-[0.5px] p-2 backdrop:blur-xl sm:p-6">
        <div className="space-y-2 divide-y-[0.5px]">
          <p className="text-theme/20 pb-2 font-mono text-xs font-light uppercase">
            {t('exploreMore.tagline')}
          </p>
          <h3 className="text-3xl font-bold">{t('exploreMore.title')}</h3>
          <p className="text-info text-lg font-light">{t('exploreMore.subtitle')}</p>
        </div>

        <div className="flex flex-row flex-wrap gap-4 py-8">
          {quickLinks.map((link) => (
            <div key={link.name} className="group">
              <Button variant="outline" asChild>
                <Link
                  to={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="flex items-center justify-center gap-3 px-6 py-3"
                >
                  <link.icon className="size-5 transition-transform" />
                  <span className="font-medium">{link.name}</span>
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Landing;
