import type { Attachment } from '@/types/main';
import {
  getAttachmentImagePreviewSrc,
  getAttachmentImageThumbnailSrc,
  getAttachmentLivePhotoPlaybackSrc,
  isHeicLikeAttachment,
} from '@/utils/directUpload';
import { describe, expect, it } from 'vitest';

function makeAttachment(overrides: Partial<Attachment>): Attachment {
  const base: Attachment = {
    id: 'attachment-1',
    url: 'https://cdn.example.com/users/u/uploads/file.jpg',
    compressUrl: 'https://cdn.example.com/users/u/compressed/file.webp',
    posterUrl: null,
    userid: 'user-1',
    roteid: 'rote-1',
    sortIndex: 0,
    storage: 'R2',
    details: {
      mimetype: 'image/jpeg',
      mediaKind: 'image',
      key: 'users/u/uploads/file.jpg',
    },
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  };

  return {
    ...base,
    ...overrides,
    details: {
      mimetype: 'image/jpeg',
      mediaKind: 'image',
      key: 'users/u/uploads/file.jpg',
      ...base.details,
      ...overrides.details,
    },
  };
}

describe('attachment image display sources', () => {
  it('uses the compressed still when previewing a Live Photo', () => {
    const attachment = makeAttachment({
      url: 'https://cdn.example.com/users/u/uploads/live.HEIC',
      compressUrl: 'https://cdn.example.com/users/u/compressed/live.webp',
      details: {
        mimetype: 'image/heic',
        mediaKind: 'livePhoto',
        key: 'users/u/uploads/live.HEIC',
        pairedVideoKey: 'users/u/paired-videos/live.mov',
      },
    });

    expect(getAttachmentImagePreviewSrc(attachment)).toBe(
      'https://cdn.example.com/users/u/compressed/live.webp'
    );
  });

  it('uses the paired MOV when playing a Live Photo', () => {
    const attachment = makeAttachment({
      url: 'https://cdn.example.com/users/u/uploads/live.HEIC',
      compressUrl: 'https://cdn.example.com/users/u/compressed/live.webp',
      details: {
        mimetype: 'image/heic',
        mediaKind: 'livePhoto',
        key: 'users/u/uploads/live.HEIC',
        pairedVideoKey: 'users/u/paired-videos/live.mov',
        pairedVideoUrl: 'https://cdn.example.com/users/u/paired-videos/live.mov',
        pairedVideoMimetype: 'video/quicktime',
      },
    });

    expect(getAttachmentLivePhotoPlaybackSrc(attachment)).toBe(
      'https://cdn.example.com/users/u/paired-videos/live.mov'
    );
  });

  it('uses the compressed still for standalone HEIC images', () => {
    const attachment = makeAttachment({
      url: 'https://cdn.example.com/users/u/uploads/photo.HEIC',
      compressUrl: 'https://cdn.example.com/users/u/compressed/photo.webp',
      details: {
        mimetype: 'image/heic',
        mediaKind: 'image',
        key: 'users/u/uploads/photo.HEIC',
      },
    });

    expect(isHeicLikeAttachment(attachment)).toBe(true);
    expect(getAttachmentImagePreviewSrc(attachment)).toBe(
      'https://cdn.example.com/users/u/compressed/photo.webp'
    );
  });

  it('uses compressUrl before posterUrl and the original URL', () => {
    const attachment = makeAttachment({
      url: 'https://cdn.example.com/users/u/uploads/photo.jpg',
      compressUrl: 'https://cdn.example.com/users/u/compressed/photo.webp',
      details: {
        mimetype: 'image/jpeg',
        mediaKind: 'image',
        key: 'users/u/uploads/photo.jpg',
      },
    });

    expect(getAttachmentImagePreviewSrc(attachment)).toBe(
      'https://cdn.example.com/users/u/compressed/photo.webp'
    );
    expect(getAttachmentImageThumbnailSrc(attachment)).toBe(
      'https://cdn.example.com/users/u/compressed/photo.webp'
    );
  });

  it('uses posterUrl when compressUrl is empty', () => {
    const attachment = makeAttachment({
      compressUrl: '',
      posterUrl: 'https://cdn.example.com/users/u/posters/photo.jpg',
    });

    expect(getAttachmentImagePreviewSrc(attachment)).toBe(
      'https://cdn.example.com/users/u/posters/photo.jpg'
    );
  });

  it('does not pass a Live Photo HEIC original to an img when its cover is missing', () => {
    const attachment = makeAttachment({
      url: 'https://cdn.example.com/users/u/uploads/live.heic',
      compressUrl: '',
      posterUrl: '',
      details: {
        mimetype: 'image/heic',
        mediaKind: 'livePhoto',
        key: 'users/u/uploads/live.heic',
        pairedVideoKey: 'users/u/paired-videos/live.mov',
      },
    });

    expect(getAttachmentImagePreviewSrc(attachment)).toBe('');
    expect(getAttachmentImageThumbnailSrc(attachment)).toBe('');
  });

  it.each([
    ['image/jpeg', 'photo.jpg'],
    ['image/png', 'photo.png'],
    ['image/gif', 'photo.gif'],
  ])('falls back to the original %s URL', (mimetype, filename) => {
    const url = `https://cdn.example.com/users/u/uploads/${filename}`;
    const attachment = makeAttachment({
      url,
      compressUrl: '',
      posterUrl: '',
      details: { key: `users/u/uploads/${filename}`, mediaKind: 'image', mimetype },
    });

    expect(getAttachmentImageThumbnailSrc(attachment)).toBe(url);
  });
});
