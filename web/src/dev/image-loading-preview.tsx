import '@/styles/index.css';
import '@/utils/i18n';
import { createRoot } from 'react-dom/client';
import { StrictMode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoProvider } from 'react-photo-view';
import { RemoteImage } from '@/components/images/RemoteImage';
import { AttachmentPhotoPreview } from '@/components/rote/AttachmentPhotoPreview';
import PostMedia from '@/components/rote/PostMedia';
import UserAvatar from '@/components/others/UserAvatar';
import { LinkPreviewCard } from '@/components/rote/LinkPreviewCard';
import { Button } from '@/components/ui/button';
import { ArticleCard } from '@/components/article/ArticleCard';
import { ImageLoadingNoteList } from './ImageLoadingNoteList';
import { MemoryRouter } from 'react-router-dom';
import type { Attachment } from '@/types/main';

function ImageLoadingPreview() {
  const { t } = useTranslation('translation', { keyPrefix: 'components.images.preview' });
  const [replay, setReplay] = useState(() => crypto.randomUUID());
  const [instance, setInstance] = useState(0);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('slow')) return;
    const slowTransition = (event: TransitionEvent) => {
      if (!(event.target instanceof Element)) return;
      event.target.getAnimations().forEach((animation) => {
        if (animation instanceof CSSTransition) animation.updatePlaybackRate(0.1);
      });
    };
    document.addEventListener('transitionrun', slowTransition);
    return () => document.removeEventListener('transitionrun', slowTransition);
  }, []);
  const fixture = (name: string, delay = 2400) =>
    `/__image-loading__/${name}.svg?replay=${replay}&delay=${delay}`;
  const attachment = (id: string, width: number, height: number): Attachment => ({
    id,
    url: fixture(id),
    compressUrl: fixture(id),
    posterUrl: '',
    userid: 'preview',
    roteid: 'preview',
    sortIndex: width,
    storage: 'preview',
    createdAt: '',
    updatedAt: '',
    details: { width, height },
  });
  const photo = (name: string, delay = 2400) => (
    <AttachmentPhotoPreview
      alt=""
      containerClassName="w-full overflow-hidden rounded-2xl border"
      imageClassName="block w-full object-cover"
      previewSrc={fixture(name, delay)}
      src={fixture(name, delay)}
      intrinsic
      layoutKey={`preview:${name}:${replay}:${delay}`}
    />
  );

  return (
    <main className="bg-background text-foreground mx-auto max-w-xl space-y-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p>{t('description')}</p>
      <div className="flex gap-3">
        <Button data-preview-replay onClick={() => setReplay(crypto.randomUUID())}>
          {t('replay')}
        </Button>
        <Button data-preview-redisplay variant="outline" onClick={() => setInstance(instance + 1)}>
          {t('redisplay')}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{t('hint')}</p>
      <div key={`${replay}:${instance}`} className="space-y-8">
        <section data-preview-natural-rail className="space-y-4">
          <h2 className="font-semibold">{t('mediaRail')}</h2>
          <p className="text-muted-foreground text-sm">{t('mediaRailHint')}</p>
          <PostMedia
            attachments={[
              'rail-landscape',
              'rail-portrait',
              'rail-long',
              'rail-square',
              'rail-live',
              'rail-panorama',
            ].map((id, sortIndex) => ({
              ...attachment(id, 1, 1),
              sortIndex,
              details: {
                mimetype: 'image/svg+xml',
                ...(id === 'rail-live' ? { mediaKind: 'livePhoto' as const } : {}),
              },
            }))}
          />
        </section>
        <section data-preview-fixed className="space-y-4">
          <h2 className="font-semibold">{t('firstLoad')}</h2>
          <div className="flex items-center gap-5">
            {[18, 44, 80].map((size) => (
              <UserAvatar
                key={size}
                avatar={fixture('avatar')}
                style={{ width: size, height: size }}
              />
            ))}
          </div>
          <RemoteImage src={fixture('cover')} className="h-44 w-full rounded-2xl" alt="" />
          <LinkPreviewCard
            preview={{ url: '#preview-link', image: fixture('link'), title: t('firstLoad') }}
          />
          <ArticleCard
            article={{
              content: `# ${t('firstLoad')}\n\n![](${fixture('article')})`,
              createdAt: '',
              updatedAt: '',
            }}
            showMenu={false}
          />
          <PhotoProvider>
            <AttachmentPhotoPreview
              alt=""
              containerClassName="size-20 overflow-hidden rounded-lg"
              imageClassName="size-full object-cover"
              src={fixture('editor')}
              previewSrc={fixture('editor')}
              width={80}
              height={80}
            />
          </PhotoProvider>
          <PostMedia
            attachments={[
              {
                ...attachment('animation', 4, 4),
                url: `/__image-loading__/animation.gif?replay=${replay}&delay=2400`,
                details: { width: 4, height: 4, mimetype: 'image/gif' },
              },
            ]}
          />
          <PostMedia
            attachments={[
              attachment('rail-a', 800, 600),
              attachment('rail-b', 400, 600),
              attachment('rail-c', 1200, 600),
            ]}
          />
        </section>
        <section data-preview-long className="space-y-4">
          <h2 className="font-semibold">{t('longImage')}</h2>
          <PhotoProvider>{photo('long', 4200)}</PhotoProvider>
        </section>
        <section data-preview-failure className="space-y-4">
          <h2 className="font-semibold">{t('failure')}</h2>
          <PhotoProvider>{photo('failure', 1800)}</PhotoProvider>
        </section>
        <section data-preview-anchor className="space-y-4">
          <h2 className="font-semibold">{t('offscreen')}</h2>
          <ImageLoadingNoteList replay={replay} label={t('offscreen')} />
          <RemoteImage
            src={fixture('offscreen', 6000)}
            className="h-32 w-full rounded-2xl"
            alt=""
          />
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <ImageLoadingPreview />
    </MemoryRouter>
  </StrictMode>
);
