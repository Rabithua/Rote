import type { Attachment } from '@/types/main';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PostMedia from './PostMedia';
import { displayMediaRatio } from './postMediaModel';

vi.mock('react-photo-view', () => ({
  PhotoProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="photo-provider">{children}</div>
  ),
  PhotoView: ({
    children,
    render: renderPhoto,
    src,
    width,
    height,
  }: {
    children: React.ReactElement;
    render?: (_props: {
      attrs: React.HTMLAttributes<HTMLElement>;
      scale: number;
      rotate: number;
    }) => React.ReactNode;
    src?: string;
    width?: number;
    height?: number;
  }) => (
    <div data-src={src} data-testid="photo-view" data-width={width} data-height={height}>
      {children}
      {renderPhoto?.({
        attrs: {
          className: 'from-photo-view',
          style: {
            width: '320px',
            height: '240px',
            objectFit: 'cover',
          },
        },
        scale: 1,
        rotate: 0,
      })}
    </div>
  ),
}));

vi.mock('./VideoAttachmentPreview', () => ({
  VideoAttachmentPreview: ({
    onLoadedMetadata,
  }: Pick<React.VideoHTMLAttributes<HTMLVideoElement>, 'onLoadedMetadata'>) => (
    <video data-testid="video-preview" onLoadedMetadata={onLoadedMetadata} />
  ),
}));

const mockAttachments: Attachment[] = [
  {
    id: '7843c449-9a8d-4622-808d-fe36d9f2d458',
    url: 'https://cos.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/uploads/68599e76-2129-4692-b0dc-d8245d0bc0dc.heic',
    compressUrl:
      'https://cos.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/68599e76-2129-4692-b0dc-d8245d0bc0dc.webp',
    posterUrl: '',
    userid: 'dbde41e2-6508-4028-9b5b-4cc15c891a47',
    roteid: 'dd8d25bf-2e89-43e7-bcab-41282d4995cf',
    sortIndex: 0,
    storage: 'R2',
    details: {
      key: 'users/dbde41e2-6508-4028-9b5b-4cc15c891a47/uploads/68599e76-2129-4692-b0dc-d8245d0bc0dc.heic',
      size: 1463952,
      mtime: '2026-06-11T15:35:24.647Z',
      mimetype: 'image/heic',
      mediaKind: 'livePhoto',
      compressKey:
        'users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/68599e76-2129-4692-b0dc-d8245d0bc0dc.webp',
      pairedVideoKey:
        'users/dbde41e2-6508-4028-9b5b-4cc15c891a47/paired-videos/68599e76-2129-4692-b0dc-d8245d0bc0dc.mov',
      pairedVideoUrl:
        'https://cos.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/paired-videos/68599e76-2129-4692-b0dc-d8245d0bc0dc.mov',
      pairedVideoSize: 4512105,
      pairedVideoFilename: 'FullSizeRender.mov',
      pairedVideoMimetype: 'video/quicktime',
    },
    createdAt: '2026-06-11T15:35:24.648Z',
    updatedAt: '2026-06-11T15:35:25.035Z',
  },
  {
    id: '3c0299d0-6b96-4c92-aaa4-bcdfb59458a7',
    url: 'https://cos.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/uploads/1fa05494-dae2-4678-88a5-dc82438adf15.jpeg',
    compressUrl:
      'https://cos.rote.ink/users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/1fa05494-dae2-4678-88a5-dc82438adf15.webp',
    posterUrl: '',
    userid: 'dbde41e2-6508-4028-9b5b-4cc15c891a47',
    roteid: 'dd8d25bf-2e89-43e7-bcab-41282d4995cf',
    sortIndex: 0,
    storage: 'R2',
    details: {
      key: 'users/dbde41e2-6508-4028-9b5b-4cc15c891a47/uploads/1fa05494-dae2-4678-88a5-dc82438adf15.jpeg',
      size: 43767,
      mtime: '2026-06-11T15:45:02.379Z',
      mimetype: 'image/jpeg',
      mediaKind: 'image',
      compressKey:
        'users/dbde41e2-6508-4028-9b5b-4cc15c891a47/compressed/1fa05494-dae2-4678-88a5-dc82438adf15.webp',
    },
    createdAt: '2026-06-11T15:45:02.380Z',
    updatedAt: '2026-06-11T15:45:02.380Z',
  },
];

function railAttachments(name: string): Attachment[] {
  return mockAttachments.map((attachment, index) => ({
    ...attachment,
    id: `${name}-${index}`,
    url: `https://example.test/${name}-${index}.${index === 0 ? 'heic' : 'jpg'}`,
    compressUrl: `https://example.test/${name}-${index}.webp`,
    sortIndex: index,
    details: { ...attachment.details },
  }));
}

function loadRailImage(item: HTMLElement, width: number, height: number) {
  const image = item.querySelector<HTMLImageElement>('.remote-image img')!;
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
  fireEvent.load(image);
}

describe('PostMedia', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps Live Photo motion isolated from normal image preview items', () => {
    const { container } = render(<PostMedia attachments={mockAttachments} />);
    const photoViews = screen.getAllByTestId('photo-view');
    const livePhotoFrame = screen.getByLabelText('videoLabel');

    expect(photoViews).toHaveLength(2);
    expect(livePhotoFrame).toHaveStyle({
      objectFit: 'contain',
    });
    expect(livePhotoFrame.querySelector('video')).toHaveAttribute(
      'src',
      mockAttachments[0].details?.pairedVideoUrl
    );
    expect(within(screen.getByTestId('photo-provider')).getByText('badge')).toBeVisible();
    expect(
      photoViews.some((view) => view.getAttribute('data-src') === mockAttachments[1].url)
    ).toBe(true);
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('.post-media-rail')).toBeInTheDocument();
    expect(container.querySelectorAll('.post-media-item')).toHaveLength(2);
  });

  it('keeps a full-width preview frame when a single Live Photo cover is unavailable', () => {
    const attachment = {
      ...mockAttachments[0],
      compressUrl: '',
      posterUrl: '',
    };
    const { container } = render(<PostMedia attachments={[attachment]} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'unavailable' })).toBeVisible();
    expect(container.firstElementChild).toHaveClass('w-full', 'max-w-[500px]');
    expect(container.querySelector('.post-media-rail')).not.toBeInTheDocument();
  });

  it('expands a multi-media rail to the card edges while keeping the avatar inset inside', () => {
    const { container } = render(<PostMedia attachments={mockAttachments} avatarInset />);

    expect(container.firstElementChild).toHaveClass('post-media-bleed', 'post-media-bleed--avatar');
    expect(container.firstElementChild).not.toHaveClass('max-w-[500px]');
  });

  it('clamps media ratios and keeps images and videos in the same rail', () => {
    const images = mockAttachments.map((item, index) => ({
      ...item,
      sortIndex: index,
      details: { ...item.details, width: index === 0 ? 900 : 300, height: 1000 },
    }));
    const video = {
      ...mockAttachments[1],
      id: 'video',
      sortIndex: 2,
      posterUrl: 'https://example.test/poster.jpg',
      details: {
        ...mockAttachments[1].details,
        mediaKind: 'video' as const,
        width: 1920,
        height: 1080,
      },
    };
    const { container } = render(<PostMedia attachments={[video, ...images]} />);
    const items = container.querySelectorAll<HTMLElement>('.post-media-item');

    expect(items).toHaveLength(3);
    expect(items[0].style.getPropertyValue('--display-ratio')).toBe('0.9');
    expect(items[1].style.getPropertyValue('--display-ratio')).toBe('0.4');
    expect(items[2].style.getPropertyValue('--display-ratio')).toBe(String(16 / 9));
    expect(items[2]).toHaveAttribute('data-media-type', 'video');
    expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    expect(displayMediaRatio(0.4)).toBe(0.4);
    expect(displayMediaRatio(2)).toBe(2);
    expect(displayMediaRatio(3)).toBe(2);
    expect(displayMediaRatio(Number.NaN)).toBe(1);
  });

  it('restores landscape and Live Photo portrait ratios when legacy thumbnails load', () => {
    const { container } = render(<PostMedia attachments={railAttachments('legacy-load')} />);
    const items = container.querySelectorAll<HTMLElement>('.post-media-item');

    expect(items[0].style.getPropertyValue('--display-ratio')).toBe('1');
    expect(items[1].style.getPropertyValue('--display-ratio')).toBe('1');
    loadRailImage(items[0], 900, 1600);
    loadRailImage(items[1], 1600, 900);

    expect(items[0].style.getPropertyValue('--display-ratio')).toBe(String(9 / 16));
    expect(items[1].style.getPropertyValue('--display-ratio')).toBe(String(16 / 9));
  });

  it('restores rail ratios for decoded browser cache hits before paint', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1600);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(900);
    const { container } = render(<PostMedia attachments={railAttachments('decoded-cache')} />);

    for (const item of container.querySelectorAll<HTMLElement>('.post-media-item')) {
      expect(item.style.getPropertyValue('--display-ratio')).toBe(String(16 / 9));
      expect(item.querySelector('.remote-image')).toHaveAttribute('data-image-state', 'ready');
    }
  });

  it('retains a measured ratio on remount but isolates a replacement thumbnail with the same id', () => {
    const attachments = railAttachments('remount-cache');
    const first = render(<PostMedia attachments={attachments} />);
    loadRailImage(first.container.querySelectorAll<HTMLElement>('.post-media-item')[1], 1600, 900);
    first.unmount();

    const second = render(<PostMedia attachments={attachments} />);
    const item = second.container.querySelectorAll<HTMLElement>('.post-media-item')[1];
    expect(item.style.getPropertyValue('--display-ratio')).toBe(String(16 / 9));
    expect(item.querySelector('.remote-image')).toHaveAttribute('data-image-state', 'loading');

    const replacement = attachments.map((attachment, index) =>
      index === 1
        ? { ...attachment, compressUrl: 'https://example.test/replacement-thumbnail.webp' }
        : attachment
    );
    second.rerender(<PostMedia attachments={replacement} />);
    expect(item.style.getPropertyValue('--display-ratio')).toBe('1');
    loadRailImage(item, 800, 1600);
    expect(item.style.getPropertyValue('--display-ratio')).toBe('0.5');

    second.rerender(<PostMedia attachments={attachments} />);
    expect(item.style.getPropertyValue('--display-ratio')).toBe(String(16 / 9));
  });

  it('uses attachment metadata ahead of cached or newly loaded thumbnail dimensions', () => {
    const attachments = railAttachments('metadata-authority');
    const { container, rerender } = render(<PostMedia attachments={attachments} />);
    const item = container.querySelectorAll<HTMLElement>('.post-media-item')[1];
    loadRailImage(item, 1600, 900);
    const withMetadata = attachments.map((attachment) => ({
      ...attachment,
      details: { ...attachment.details, width: 400, height: 800 },
    }));
    rerender(<PostMedia attachments={withMetadata} />);
    expect(item.style.getPropertyValue('--display-ratio')).toBe('0.5');

    const otherThumbnail = withMetadata.map((attachment, index) =>
      index === 1
        ? { ...attachment, compressUrl: 'https://example.test/metadata-thumbnail.webp' }
        : attachment
    );
    rerender(<PostMedia attachments={otherThumbnail} />);
    loadRailImage(item, 1600, 900);
    expect(item.style.getPropertyValue('--display-ratio')).toBe('0.5');
  });

  it('restores a legacy video ratio from loaded metadata using the same rail range', () => {
    const attachments = railAttachments('legacy-video');
    attachments[1] = {
      ...attachments[1],
      posterUrl: 'https://example.test/legacy-video-poster.jpg',
      details: { ...attachments[1].details, mediaKind: 'video', mimetype: 'video/mp4' },
    };
    const { container } = render(<PostMedia attachments={attachments} />);
    const item = container.querySelectorAll<HTMLElement>('.post-media-item')[1];
    const video = screen.getByTestId('video-preview');
    Object.defineProperties(video, {
      videoWidth: { value: 3840 },
      videoHeight: { value: 1080 },
    });
    fireEvent.loadedMetadata(video);

    expect(item.style.getPropertyValue('--display-ratio')).toBe('2');
  });
});
