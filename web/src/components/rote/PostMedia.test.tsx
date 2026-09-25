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
  VideoAttachmentPreview: () => <div data-testid="video-preview" />,
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
      photoViews.some((view) => view.getAttribute('data-src') === mockAttachments[1].compressUrl)
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
    expect(screen.getByRole('img', { name: 'imageUnavailable' })).toBeVisible();
    expect(container.firstElementChild).toHaveClass('w-full', 'max-w-[500px]');
    expect(container.querySelector('.post-media-rail')).not.toBeInTheDocument();
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
    expect(items[1].style.getPropertyValue('--display-ratio')).toBe('0.6');
    expect(items[2].style.getPropertyValue('--display-ratio')).toBe('1.25');
    expect(items[2]).toHaveAttribute('data-media-type', 'video');
    expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    expect(displayMediaRatio(Number.NaN)).toBe(1);
  });

  it('updates a legacy image ratio after its dimensions load', () => {
    const { container } = render(<PostMedia attachments={mockAttachments} />);
    const image = container.querySelector<HTMLImageElement>('.post-media-item:nth-child(2) img')!;
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
    });
    fireEvent.load(image);
    expect(
      container
        .querySelectorAll<HTMLElement>('.post-media-item')[1]
        .style.getPropertyValue('--display-ratio')
    ).toBe('1.25');
  });
});
