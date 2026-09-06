import { describe, expect, it } from 'bun:test';
import { sharedAttachmentDetails } from './presentation';

describe('anonymous attachment presentation', () => {
  it('preserves legacy Live Photo playback while excluding its storage key', () => {
    expect(
      sharedAttachmentDetails({
        pairedVideoKey: 'private-key',
        pairedVideoUrl: 'https://example.test/video.mov',
        mimetype: 'image/heic',
        metadata: { user: 'private' },
      })
    ).toEqual({
      mediaKind: 'livePhoto',
      mimetype: 'image/heic',
      pairedVideoUrl: 'https://example.test/video.mov',
    });
  });
  it('recognizes video and retains the imported preview authorization hint', () => {
    expect(
      sharedAttachmentDetails({ mimetype: 'video/mp4', previewRequiresAuthorization: true })
    ).toEqual({ mediaKind: 'video', mimetype: 'video/mp4', previewRequiresAuthorization: true });
  });
});
