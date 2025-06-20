import Logo from '@/components/others/logo';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { ArrowRight, BookOpen, Code, ExternalLink, Github, Shield, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function Landing() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.landing' });

  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const features = [
    {
      icon: BookOpen,
      title: t('types.0'), // 复杂格式文章
      description: '支持富文本编辑，图片、代码等多媒体内容',
    },
    {
      icon: Sparkles,
      title: t('types.2'), // 灵感图库
      description: '收集和整理创意想法，构建你的灵感库',
    },
    {
      icon: Code,
      title: t('openApi'),
      description: '开放 API 接口，支持多种记录方式',
    },
    {
      icon: Shield,
      title: t('data'),
      description: '完全掌控你的数据，自由导入导出',
    },
  ];

  const quickLinks = [
    {
      name: 'github',
      href: 'https://github.com/Rabithua/Rote',
      icon: Github,
      external: true,
    },
    {
      name: 'blog',
      href: 'https://rabithua.club',
      icon: ExternalLink,
      external: true,
    },
  ];

  return (
    <div className="min-h-dvh">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration - 更简洁的背景 */}
        <div className="absolute inset-0">
          <div className="from-muted/20 via-background to-background absolute inset-0 bg-gradient-to-b"></div>
          {/* 只保留一个微妙的装饰元素 */}
          <div className="via-border absolute top-20 left-1/2 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent opacity-50"></div>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 pt-5 pb-20">
          <div className="text-center">
            {/* Logo and Title - 更优雅的层次 */}
            <div className="mb-12 flex items-end gap-4">
              <div className="flex justify-center">
                <Logo className="h-6 w-auto opacity-90" color="#374151" />
              </div>

              {/* 诗句 - 更小更低调 */}
              <div className="flex items-center justify-center gap-2">
                <div className="bg-muted-foreground/40 h-1 w-1 rounded-full"></div>
                <span className="text-muted-foreground/80 text-sm font-light tracking-wide">
                  {t('poem')}
                </span>
                <div className="bg-muted-foreground/40 h-1 w-1 rounded-full"></div>
              </div>
            </div>

            {/* Main heading - 更克制的设计 */}
            <div className="mb-10 space-y-4">
              <h1 className="text-foreground text-3xl leading-tight font-light tracking-tight sm:text-4xl lg:text-5xl">
                {t('slogen')}
              </h1>

              {/* 副标题 - 更清晰的层次 */}
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed font-light">
                {t('openApi')} · {t('data')}
              </p>
            </div>

            {/* Type tags - 更简洁的设计 */}
            <div className="mb-12">
              <div className="bg-muted/30 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border px-4 py-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i}>
                    <span className="text-muted-foreground text-sm font-light">
                      {t(`types.${i}`)}
                    </span>
                    {i < 4 && <span className="text-muted-foreground/50 mx-1.5">·</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA Buttons - 更优雅的按钮设计 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                <Link className="text-white hover:text-white" to={profile ? '/home' : '/login'}>
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
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">核心特性</h2>
            <p className="text-muted-foreground text-lg">为现代笔记体验精心设计的功能特性</p>
          </div>

          <div className="space-y-8">
            {features.map((feature, index) => (
              <div key={index}>
                <div className="hover:bg-accent/5 group flex flex-col items-center gap-6 py-8 transition-all duration-300 sm:flex-row sm:items-start">
                  {/* Icon */}
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[#07C160]/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-[#07C160]/20">
                    <feature.icon className="size-8 text-[#07C160]" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>

                {/* 分割线，最后一个特性后不显示 */}
                {index < features.length - 1 && (
                  <div className="via-border mx-auto h-px w-full max-w-2xl bg-gradient-to-r from-transparent to-transparent"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links Section */}
      <div className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 text-center">
            <h3 className="mb-2 text-2xl font-semibold">探索更多</h3>
            <p className="text-muted-foreground">了解项目详情，加入开源社区</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            {quickLinks.map((link, index) => (
              <div key={link.name} className="group">
                <Button variant="outline" asChild className="hover:bg-muted/50 w-full sm:w-auto">
                  <Link
                    to={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="flex items-center justify-center gap-3 px-6 py-3"
                  >
                    <link.icon className="size-5 transition-transform" />
                    <span className="font-medium">{t(`linksItems.${index + 2}`)}</span>
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
