import v2ReleaseSvg from '@/assets/v2.0.svg?raw';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTypewriter } from '@/hooks/useTypewriter';
import { isTokenValid } from '@/utils/main';
import { ArrowUpRight, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function LandingHero() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.landing' });
  const typewriterTexts = t('typewriterTexts', { returnObjects: true }) as string[];
  const typewriterText = useTypewriter({
    texts: typewriterTexts,
    typingSpeed: 100,
    deletingSpeed: 50,
    pauseTime: 2000,
  });

  return (
    <div className="bg-background relative space-y-6 divide-y-[0.5px] overflow-hidden border-r border-l py-20 sm:mx-4">
      <div className="space-y-2 divide-y-[0.5px] px-2">
        <div className="space-y-3">
          <div
            className="text-foreground h-10 w-fit [&_svg]:block [&_svg]:h-full [&_svg]:w-auto"
            role="img"
            aria-label="Rote v2.0 AI is ready"
            dangerouslySetInnerHTML={{ __html: v2ReleaseSvg }}
          />
          <h1 className="text-foreground text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('headingBefore')}
            <br className="block sm:hidden" />
            <span className="text-theme inline-block">
              {typewriterText}
              <span className="animate-pulse font-thin">|</span>
            </span>
            {t('headingAfter')}
          </h1>
        </div>

        <p className="text-info pb-3 text-xl leading-relaxed font-light">{t('subtitle')}</p>
      </div>

      <div className="flex flex-row flex-wrap items-center gap-3 px-2 pb-4">
        <Button size="lg" asChild>
          <Link
            to={isTokenValid() ? '/home' : '/login'}
            className="text-background hover:text-background"
          >
            {isTokenValid() ? t('dashboard') : t('linksItems.0')}
          </Link>
        </Button>

        <Button
          variant="outline"
          asChild
          size="lg"
          className="border-muted-foreground/20 hover:bg-muted/50"
        >
          <Link target="_blank" rel="noopener noreferrer" to="https://demo.rote.ink/login">
            Demo
            <ArrowUpRight className="inline-block size-5" />
          </Link>
        </Button>

        <Link
          to="https://apps.apple.com/us/app/rote/id6755513897"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center"
        >
          <img
            src="/download-on-the-app-store.svg"
            alt="Download on the App Store"
            className="h-10"
          />
        </Link>

        <Button
          variant="outline"
          size="lg"
          asChild
          className="border-muted-foreground/20 hover:bg-muted/50"
        >
          <Link to="https://github.com/Rabithua/Rote" target="_blank">
            <Github className="size-4" />
            {t('linksItems.2')}
            <ArrowUpRight className="inline-block size-5" />
          </Link>
        </Button>
      </div>

      <div className="group absolute right-10 bottom-0 flex flex-col items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="https://apps.apple.com/us/app/rote/id6755513897"
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-10 translate-y-3 rotate-5 transition-all duration-300 group-hover:-translate-y-2 group-hover:scale-110"
            >
              <img
                src="/ios_icon_compressed.png"
                alt="hero"
                className="z-1 h-10 drop-shadow-2xl drop-shadow-black/10 dark:hidden"
              />
              <img
                src="/ios_icon_dark_compressed.png"
                alt="hero"
                className="z-1 hidden h-10 drop-shadow-2xl drop-shadow-black/10 dark:block"
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            <div className="flex flex-col gap-1">
              <span>{t('iosAppTooltip.title')}</span>
              <Link
                to="https://testflight.apple.com/join/WC3ETKwp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-theme hover:text-theme/80 inline-flex items-center hover:underline"
              >
                {t('iosAppTooltip.earlyAccess')}
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
