type AttachmentDetails = Record<string, unknown>;

// Explicitly allow only media playback hints. Storage keys, bucket identities,
// upload metadata and original filenames are not part of anonymous sharing.
export function sharedAttachmentDetails(details: unknown) {
  const source: AttachmentDetails =
    details && typeof details === 'object' ? (details as AttachmentDetails) : {};
  const mimetype = typeof source.mimetype === 'string' ? source.mimetype : null;
  const mediaKind =
    source.mediaKind === 'livePhoto' || source.pairedVideoKey
      ? 'livePhoto'
      : source.mediaKind === 'video' || mimetype?.startsWith('video/')
        ? 'video'
        : 'image';

  return {
    mediaKind,
    mimetype,
    ...(mediaKind === 'livePhoto' && typeof source.pairedVideoUrl === 'string'
      ? { pairedVideoUrl: source.pairedVideoUrl }
      : {}),
    ...(source.previewRequiresAuthorization === true ? { previewRequiresAuthorization: true } : {}),
  };
}
