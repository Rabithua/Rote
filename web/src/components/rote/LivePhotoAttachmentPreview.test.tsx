import type { Attachment } from '@/types/main';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LivePhotoAttachmentPreview } from './LivePhotoAttachmentPreview';

vi.mock('react-photo-view', () => ({
  PhotoView: ({
    children,
    render: renderPhoto,
    width,
    height,
  }: {
    children: React.ReactElement;
    render?: (_props: {
      attrs: React.HTMLAttributes<HTMLElement>;
      scale: number;
      rotate: number;
    }) => React.ReactNode;
    width?: number;
    height?: number;
  }) => (
    <div data-testid="photo-view" data-width={width} data-height={height}>
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

function makeLivePhotoAttachment(): Attachment {
  return {
    id: 'attachment-1',
    url: 'https://cdn.example.com/users/u/uploads/live.HEIC',
    compressUrl: 'https://cdn.example.com/users/u/compressed/live.webp',
    posterUrl: null,
    userid: 'user-1',
    roteid: 'rote-1',
    sortIndex: 0,
    storage: 'R2',
    details: {
      mimetype: 'image/heic',
      mediaKind: 'livePhoto',
      key: 'users/u/uploads/live.HEIC',
      pairedVideoKey: 'users/u/paired-videos/live.mov',
      pairedVideoUrl: 'https://cdn.example.com/users/u/paired-videos/live.mov',
      pairedVideoMimetype: 'video/quicktime',
      pairedVideoSize: 1234,
    },
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  };
}

describe('LivePhotoAttachmentPreview', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the PhotoView motion frame aspect-fit even when the thumbnail source is cover', () => {
    const { container } = render(
      <LivePhotoAttachmentPreview
        attachment={makeLivePhotoAttachment()}
        previewSrc="https://cdn.example.com/users/u/compressed/live.webp"
        thumbnailSrc="https://cdn.example.com/users/u/compressed/live.webp"
      />
    );

    const frame = screen.getByLabelText('videoLabel');
    const video = container.querySelector('video');

    expect(frame).toHaveStyle({ objectFit: 'contain' });
    expect(video).toHaveClass('object-contain');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('loop');
    expect(video).toHaveAttribute('preload', 'metadata');
  });

  it('bounds the registered preview dimensions while preserving the still aspect ratio', () => {
    const { container } = render(
      <LivePhotoAttachmentPreview
        attachment={makeLivePhotoAttachment()}
        previewSrc="https://cdn.example.com/users/u/compressed/live.webp"
        thumbnailSrc="https://cdn.example.com/users/u/compressed/live.webp"
      />
    );

    const thumbnail = container.querySelector(
      'img[src="https://cdn.example.com/users/u/compressed/live.webp"]'
    );
    expect(thumbnail).toBeInstanceOf(HTMLImageElement);

    Object.defineProperty(thumbnail, 'naturalWidth', { value: 4032, configurable: true });
    Object.defineProperty(thumbnail, 'naturalHeight', { value: 3024, configurable: true });
    fireEvent.load(thumbnail as HTMLImageElement);

    expect(screen.getByTestId('photo-view')).toHaveAttribute('data-width', '939');
    expect(screen.getByTestId('photo-view')).toHaveAttribute('data-height', '704');
  });

  it('shows a placeholder and no broken img when the compatible still is missing', () => {
    const { container } = render(
      <LivePhotoAttachmentPreview
        attachment={{
          ...makeLivePhotoAttachment(),
          compressUrl: '',
          posterUrl: '',
        }}
        previewSrc=""
        thumbnailSrc=""
      />
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'imageUnavailable' })).toBeVisible();
    expect(screen.queryByTestId('photo-view')).not.toBeInTheDocument();
  });

  it('removes the invalid PhotoView target after the compatible still fails to load', () => {
    const { container } = render(
      <LivePhotoAttachmentPreview
        attachment={makeLivePhotoAttachment()}
        previewSrc="https://cdn.example.com/users/u/compressed/missing.jpg"
        thumbnailSrc="https://cdn.example.com/users/u/compressed/missing.jpg"
      />
    );
    const thumbnail = container.querySelector('img');

    expect(screen.getByTestId('photo-view')).toBeInTheDocument();
    fireEvent.error(thumbnail!);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'imageUnavailable' })).toBeVisible();
    expect(screen.queryByTestId('photo-view')).not.toBeInTheDocument();
  });
});
