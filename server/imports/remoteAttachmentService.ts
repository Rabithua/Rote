import { randomUUID } from 'node:crypto';
import { getUploadExtension } from '../attachments/uploadKeys';
import { getAttachmentUploadPolicy } from '../attachments/uploadPolicy';
import { requireStorageAvailable } from '../attachments/types';
import {
  getMediaKindFromContentType,
  getMaxVideoUploadSizeBytes,
  isVideoContentType,
  MAX_IMAGE_FILE_SIZE,
  validateContentType,
} from '../utils/fileValidation';
import { assertSafeOutboundUrl } from '../utils/adminHooks/network';
import { storeObject } from '../utils/r2';
import type { ImportAttachment, ImportPayload } from './importSchema';

const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
const MAX_CONCURRENT_DOWNLOADS = 4;
export const REMOTE_ATTACHMENT_MIGRATION_FAILED = 'remote_attachment_migration_failed';

type StoredRemoteAsset = {
  contentType: string;
  key: string;
  size: number;
  url: string;
};

type RemoteAttachmentDependencies = {
  assertSafeOutboundUrl: typeof assertSafeOutboundUrl;
  fetcher: typeof fetch;
  getAttachmentUploadPolicy: typeof getAttachmentUploadPolicy;
  randomUUID: typeof randomUUID;
  requireStorageAvailable: typeof requireStorageAvailable;
  storeObject: typeof storeObject;
};

const defaultDependencies: RemoteAttachmentDependencies = {
  assertSafeOutboundUrl,
  fetcher: fetch,
  getAttachmentUploadPolicy,
  randomUUID,
  requireStorageAvailable,
  storeObject,
};

export async function migrateRemoteAttachments(
  userId: string,
  payload: ImportPayload,
  noteIndexes: Set<number>,
  dependencyOverrides: Partial<RemoteAttachmentDependencies> = {}
): Promise<ImportPayload> {
  const selectedAttachments = payload.notes.flatMap((note, index) =>
    noteIndexes.has(index) ? (note.attachments ?? []) : []
  );
  if (!selectedAttachments.some((attachment) => isRemoteUrl(attachment.url))) return payload;

  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const storage = dependencies.requireStorageAvailable();
  const currentPrefix = storage.urlPrefix.trim().replace(/\/+$/, '');
  if (!currentPrefix) throw new Error(REMOTE_ATTACHMENT_MIGRATION_FAILED);
  const hasExternalAttachment = selectedAttachments.some(
    (attachment) =>
      isRemoteUrl(attachment.url) && !isCurrentStorageUrl(attachment.url, currentPrefix)
  );
  if (!hasExternalAttachment) return payload;

  const policy = await dependencies.getAttachmentUploadPolicy(userId);
  if (!policy.canUploadAttachments) throw new Error(REMOTE_ATTACHMENT_MIGRATION_FAILED);

  const cache = new Map<string, Promise<StoredRemoteAsset>>();
  const runDownload = createConcurrencyLimiter(MAX_CONCURRENT_DOWNLOADS);
  const notes = await Promise.all(
    payload.notes.map(async (note, noteIndex) => {
      if (!noteIndexes.has(noteIndex) || !note.attachments?.length) return note;
      const attachments = await Promise.all(
        note.attachments.map((attachment) =>
          migrateAttachment(
            userId,
            attachment,
            currentPrefix,
            policy,
            cache,
            runDownload,
            dependencies
          )
        )
      );
      return { ...note, attachments };
    })
  ).catch((error) => {
    // eslint-disable-next-line no-console -- preserve server-side diagnostics without exposing details to clients
    console.warn('[remote-attachment-import] migration failed:', error);
    throw new Error(REMOTE_ATTACHMENT_MIGRATION_FAILED);
  });

  return { ...payload, notes };
}

async function migrateAttachment(
  userId: string,
  attachment: ImportAttachment,
  currentPrefix: string,
  policy: Awaited<ReturnType<typeof getAttachmentUploadPolicy>>,
  cache: Map<string, Promise<StoredRemoteAsset>>,
  runDownload: ConcurrencyLimiter,
  dependencies: RemoteAttachmentDependencies
): Promise<ImportAttachment> {
  if (!isRemoteUrl(attachment.url) || isCurrentStorageUrl(attachment.url, currentPrefix)) {
    return attachment;
  }

  const details = attachment.details ?? {};
  const filename = stringDetail(details, 'originalname') || stringDetail(details, 'key');
  const declaredType = normalizeContentType(stringDetail(details, 'mimetype'));
  const original = await migrateAsset(
    userId,
    attachment.url,
    'uploads',
    filename,
    declaredType,
    policy,
    cache,
    runDownload,
    dependencies
  );
  const mediaKind = getMediaKindFromContentType(original.contentType);
  if (!mediaKind || (mediaKind === 'video' && !policy.canUploadVideo)) {
    throw new Error('remote attachment media type is not allowed');
  }

  const compressUrl = optionalRemoteUrl(attachment.compressUrl, attachment.url);
  const compressed = compressUrl
    ? await migrateAsset(
        userId,
        compressUrl,
        'compressed',
        undefined,
        'image/webp',
        policy,
        cache,
        runDownload,
        dependencies
      )
    : undefined;
  const posterUrl = optionalRemoteUrl(attachment.posterUrl, attachment.url);
  const poster = posterUrl
    ? await migrateAsset(
        userId,
        posterUrl,
        'posters',
        undefined,
        'image/jpeg',
        policy,
        cache,
        runDownload,
        dependencies
      )
    : undefined;
  const pairedVideoUrl = stringDetail(details, 'pairedVideoUrl');
  const pairedVideo = isRemoteUrl(pairedVideoUrl)
    ? await migrateAsset(
        userId,
        pairedVideoUrl,
        'paired-videos',
        stringDetail(details, 'pairedVideoFilename'),
        normalizeContentType(stringDetail(details, 'pairedVideoMimetype')),
        policy,
        cache,
        runDownload,
        dependencies
      )
    : undefined;

  return {
    ...attachment,
    url: original.url,
    compressUrl: compressed?.url ?? (mediaKind === 'image' ? original.url : ''),
    posterUrl: poster?.url ?? '',
    storage: 'R2',
    details: {
      ...details,
      key: original.key,
      size: original.size,
      mimetype: original.contentType,
      mediaKind: pairedVideo ? 'livePhoto' : mediaKind,
      compressKey: compressed?.key ?? (mediaKind === 'image' ? original.key : ''),
      posterKey: poster?.key ?? '',
      pairedVideoKey: pairedVideo?.key,
      pairedVideoUrl: pairedVideo?.url,
      pairedVideoSize: pairedVideo?.size,
      pairedVideoMimetype: pairedVideo?.contentType,
    },
  };
}

async function migrateAsset(
  userId: string,
  sourceUrl: string,
  directory: 'uploads' | 'compressed' | 'posters' | 'paired-videos',
  filename: string | undefined,
  declaredType: string | undefined,
  policy: Awaited<ReturnType<typeof getAttachmentUploadPolicy>>,
  cache: Map<string, Promise<StoredRemoteAsset>>,
  runDownload: ConcurrencyLimiter,
  dependencies: RemoteAttachmentDependencies
): Promise<StoredRemoteAsset> {
  const cacheKey = `${directory}\u0000${sourceUrl}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const migration = runDownload(async () => {
    const response = await fetchSafe(sourceUrl, dependencies);
    const responseType = normalizeContentType(response.headers.get('content-type'));
    const contentType = responseType || declaredType;
    if (!contentType) throw new Error('remote attachment content type is missing');
    validateContentType(contentType);
    if (isVideoContentType(contentType) && !policy.canUploadVideo) {
      throw new Error('remote video migration is not allowed');
    }
    const maxSize = isVideoContentType(contentType)
      ? getMaxVideoUploadSizeBytes(policy.maxVideoUploadSizeMB)
      : MAX_IMAGE_FILE_SIZE;
    const bytes = await readLimitedBody(response, maxSize);
    const resolvedFilename = filename || filenameFromUrl(response.url || sourceUrl);
    const key = `users/${userId}/${directory}/${dependencies.randomUUID()}${getUploadExtension(resolvedFilename, contentType)}`;
    const stored = await dependencies.storeObject(key, bytes, contentType);
    return { contentType, key, size: bytes.byteLength, url: stored.url };
  });
  cache.set(cacheKey, migration);
  return migration;
}

async function fetchSafe(
  initialUrl: string,
  dependencies: RemoteAttachmentDependencies
): Promise<Response> {
  let currentUrl = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    await dependencies.assertSafeOutboundUrl(currentUrl, 'Remote attachment URL');
    const response = await dependencies.fetcher(currentUrl, {
      headers: { Accept: 'image/*,video/*' },
      redirect: 'manual',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('remote redirect failed');
      await response.body?.cancel();
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok || !response.body)
      throw new Error(`remote download failed: ${response.status}`);
    return response;
  }
  throw new Error('remote redirect failed');
}

type ConcurrencyLimiter = <T>(task: () => Promise<T>) => Promise<T>;

function createConcurrencyLimiter(limit: number): ConcurrencyLimiter {
  let active = 0;
  const queue: Array<() => void> = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}

async function readLimitedBody(response: Response, maxSize: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxSize) {
    throw new Error('remote attachment exceeds size limit');
  }

  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxSize) {
      await reader.cancel();
      throw new Error('remote attachment exceeds size limit');
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error('remote attachment is empty');

  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes;
}

function isRemoteUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//iu.test(value);
}

function isCurrentStorageUrl(value: string, currentPrefix: string): boolean {
  return (
    Boolean(currentPrefix) && (value === currentPrefix || value.startsWith(`${currentPrefix}/`))
  );
}

function optionalRemoteUrl(value: string | undefined, originalUrl: string): string | undefined {
  return isRemoteUrl(value) && value !== originalUrl ? value : undefined;
}

function normalizeContentType(value: string | null | undefined): string | undefined {
  return value?.split(';', 1)[0].trim().toLowerCase() || undefined;
}

function stringDetail(details: Record<string, unknown>, key: string): string | undefined {
  const value = details[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function filenameFromUrl(value: string): string | undefined {
  try {
    return new URL(value).pathname.split('/').filter(Boolean).pop();
  } catch {
    return undefined;
  }
}
