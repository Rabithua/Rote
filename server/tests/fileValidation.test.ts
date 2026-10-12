import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB,
  MAX_FILES,
  getMaxVideoUploadSizeBytes,
  getMediaKindFromFilename,
  inferAttachmentMediaKind,
  mergeUniqueRoteAttachmentDetails,
  validateFileSize,
  validateRoteAttachmentDetails,
} from '../utils/fileValidation';

describe('fileValidation', () => {
  it('allows a single video attachment', () => {
    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            mediaKind: 'video',
            mimetype: 'video/mp4',
          },
        },
      ])
    ).not.toThrow();
  });

  it('allows mixed image and video attachments', () => {
    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            mediaKind: 'image',
            mimetype: 'image/png',
          },
        },
        {
          details: {
            mediaKind: 'video',
            mimetype: 'video/mp4',
          },
        },
      ])
    ).not.toThrow();
  });

  it('allows multiple videos within the media limit', () => {
    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            mediaKind: 'video',
            mimetype: 'video/mp4',
          },
        },
        {
          details: {
            mediaKind: 'video',
            mimetype: 'video/webm',
          },
        },
      ])
    ).not.toThrow();
  });

  it('rejects more than the max number of media attachments', () => {
    const attachments = Array.from({ length: MAX_FILES + 1 }, () => ({
      details: {
        mediaKind: 'image',
        mimetype: 'image/png',
      },
    }));

    expect(() => validateRoteAttachmentDetails(attachments)).toThrow(
      `Maximum ${MAX_FILES} media attachments can be uploaded to a Rote`
    );
  });

  it('treats Live Photos as image-like attachments', () => {
    expect(
      inferAttachmentMediaKind({
        pairedVideoKey: 'users/test/paired-videos/live.mov',
      })
    ).toBe('livePhoto');

    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            mediaKind: 'image',
            mimetype: 'image/png',
          },
        },
        {
          details: {
            mediaKind: 'livePhoto',
            mimetype: 'image/heic',
            key: 'users/test/uploads/live.heic',
            compressKey: 'users/test/compressed/live.webp',
            pairedVideoKey: 'users/test/paired-videos/live.mov',
          },
        },
      ])
    ).not.toThrow();
  });

  it('allows mixing Live Photos with standalone videos', () => {
    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            mediaKind: 'livePhoto',
            mimetype: 'image/heic',
            pairedVideoKey: 'users/test/paired-videos/live.mov',
          },
        },
        {
          details: {
            mediaKind: 'video',
            mimetype: 'video/mp4',
          },
        },
      ])
    ).not.toThrow();
  });

  it('uses configured video upload size limit', () => {
    const maxVideoSizeMB = DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB + 50;
    const allowedSize = getMaxVideoUploadSizeBytes(maxVideoSizeMB);

    expect(() => validateFileSize(allowedSize, 'video/mp4', maxVideoSizeMB)).not.toThrow();
    expect(() => validateFileSize(allowedSize + 1, 'video/mp4', maxVideoSizeMB)).toThrow(
      `Video file size exceeds limit: ${allowedSize} bytes`
    );
  });

  it('treats attachments with compressed keys as images when mimetype is missing', () => {
    expect(
      inferAttachmentMediaKind({
        compressedKey: 'users/test/compressed/example.webp',
      })
    ).toBe('image');

    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            key: 'users/test/uploads/example.png',
            compressKey: 'users/test/compressed/example.webp',
          },
        },
      ])
    ).not.toThrow();
  });

  it('treats attachments with poster keys as videos when mimetype is missing', () => {
    expect(
      inferAttachmentMediaKind({
        posterKey: 'users/test/posters/example.jpg',
      })
    ).toBe('video');

    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            key: 'users/test/uploads/example.mp4',
            posterKey: 'users/test/posters/example.jpg',
          },
        },
      ])
    ).not.toThrow();
  });

  it('infers legacy attachment media kind from the stored key extension', () => {
    expect(getMediaKindFromFilename('users/test/uploads/example.mp4')).toBe('video');
    expect(getMediaKindFromFilename('users/test/uploads/example.png')).toBe('image');

    expect(
      inferAttachmentMediaKind({
        key: 'users/test/uploads/example.mp4',
      })
    ).toBe('video');

    expect(() =>
      validateRoteAttachmentDetails([
        {
          details: {
            key: 'users/test/uploads/example.mp4',
          },
        },
      ])
    ).not.toThrow();
  });

  it('prefers original key extension over compressed key when inferring media kind', () => {
    expect(
      inferAttachmentMediaKind({
        key: 'users/test/uploads/example.mp4',
        compressedKey: 'users/test/compressed/example.webp',
      })
    ).toBe('video');
  });

  it('ignores duplicate attachment keys when merging retry payloads', () => {
    const merged = mergeUniqueRoteAttachmentDetails(
      [
        {
          details: {
            key: 'users/test/uploads/video.mp4',
            mediaKind: 'video',
            mimetype: 'video/mp4',
          },
        },
      ],
      [
        {
          details: {
            key: 'users/test/uploads/video.mp4',
            mediaKind: 'video',
            mimetype: 'video/mp4',
          },
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(() => validateRoteAttachmentDetails(merged)).not.toThrow();
  });
});
