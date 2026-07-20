import { randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { finalizeAttachmentUploads } from '../attachments/finalizeUpload';
import { getAttachmentUploadPolicy } from '../attachments/uploadPolicy';
import { requireStorageAvailable } from '../attachments/types';
import { getUploadExtension } from '../attachments/uploadKeys';
import {
  getMaxVideoUploadSizeBytes,
  isImageContentType,
  isVideoContentType,
  MAX_IMAGE_FILE_SIZE,
  validateContentType,
} from '../utils/fileValidation';
import { assertSafeOutboundUrl } from '../utils/adminHooks/network';
import { r2deletehandler, storeObjectStream } from '../utils/r2';
import type { ImportAttachment } from './importSchema';

const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const MAX_REDIRECTS = 3;
const DEFAULT_GLOBAL_CONCURRENCY = 24;
const MAX_GLOBAL_QUEUE = 200;

export type RemoteAttachmentMigrationErrorCode =
  | 'remote_attachment_busy'
  | 'remote_attachment_download_failed'
  | 'remote_attachment_invalid'
  | 'remote_attachment_forbidden'
  | 'remote_attachment_storage_unavailable'
  | 'remote_attachment_too_large'
  | 'remote_attachment_unsupported';

export class RemoteAttachmentMigrationError extends Error {
  constructor(
    public readonly code: RemoteAttachmentMigrationErrorCode,
    public readonly status: 400 | 403 | 413 | 422 | 429 | 502 | 503
  ) {
    super(code);
  }
}

type AssetRole = 'original' | 'compressed' | 'poster' | 'pairedVideo';

type MigrationDependencies = {
  assertSafeOutboundUrl: typeof assertSafeOutboundUrl;
  fetcher: typeof fetch;
  finalizeAttachmentUploads: typeof finalizeAttachmentUploads;
  getAttachmentUploadPolicy: typeof getAttachmentUploadPolicy;
  randomUUID: typeof randomUUID;
  removeObject: typeof r2deletehandler;
  requireStorageAvailable: typeof requireStorageAvailable;
  storeObjectStream: typeof storeObjectStream;
};

type MigrationOptions = {
  auth?: {
    baseUrl: string;
    bearerToken?: string;
  };
};

const defaultDependencies: MigrationDependencies = {
  assertSafeOutboundUrl,
  fetcher: fetch,
  finalizeAttachmentUploads,
  getAttachmentUploadPolicy,
  randomUUID,
  removeObject: r2deletehandler,
  requireStorageAvailable,
  storeObjectStream,
};

const globalTransferLimiter = createRemoteAttachmentLimiter(
  readGlobalConcurrency(),
  MAX_GLOBAL_QUEUE
);

export async function migrateOneRemoteAttachment(
  userId: string,
  attachment: ImportAttachment,
  dependencyOverrides: Partial<MigrationDependencies> = {},
  options: MigrationOptions = {}
) {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  if (!isRemoteUrl(attachment.url)) {
    throw new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
  }
  try {
    dependencies.requireStorageAvailable();
  } catch {
    throw new RemoteAttachmentMigrationError('remote_attachment_storage_unavailable', 503);
  }
  const policy = await dependencies.getAttachmentUploadPolicy(userId).catch(() => {
    throw new RemoteAttachmentMigrationError('remote_attachment_forbidden', 403);
  });
  if (!policy.canUploadAttachments) {
    throw new RemoteAttachmentMigrationError('remote_attachment_forbidden', 403);
  }

  const details = attachment.details ?? {};
  const uuid = dependencies.randomUUID();
  const uploadedKeys: string[] = [];

  try {
    const original = await migrateAsset({
      userId,
      uuid,
      sourceUrl: attachment.url,
      directory: 'uploads',
      filename: stringDetail(details, 'originalname') ?? stringDetail(details, 'key'),
      declaredType: stringDetail(details, 'mimetype'),
      role: 'original',
      uploadedKeys,
      maxVideoUploadSizeMB: policy.maxVideoUploadSizeMB,
      canUploadVideo: policy.canUploadVideo,
      dependencies,
      auth: options.auth,
    });
    const mediaKind = isImageContentType(original.contentType)
      ? 'image'
      : isVideoContentType(original.contentType)
        ? 'video'
        : null;
    if (!mediaKind) {
      throw new RemoteAttachmentMigrationError('remote_attachment_unsupported', 422);
    }

    const compressedUrl = distinctRemoteUrl(attachment.compressUrl, attachment.url);
    const posterUrl = distinctRemoteUrl(attachment.posterUrl, attachment.url);
    const pairedVideoUrl = stringDetail(details, 'pairedVideoUrl');
    const companionResults = await Promise.allSettled([
      compressedUrl
        ? migrateAsset({
            userId,
            uuid,
            sourceUrl: compressedUrl,
            directory: 'compressed',
            declaredType: 'image/webp',
            role: 'compressed',
            uploadedKeys,
            maxVideoUploadSizeMB: policy.maxVideoUploadSizeMB,
            canUploadVideo: policy.canUploadVideo,
            dependencies,
            auth: options.auth,
          })
        : undefined,
      posterUrl
        ? migrateAsset({
            userId,
            uuid,
            sourceUrl: posterUrl,
            directory: 'posters',
            declaredType: 'image/jpeg',
            role: 'poster',
            uploadedKeys,
            maxVideoUploadSizeMB: policy.maxVideoUploadSizeMB,
            canUploadVideo: policy.canUploadVideo,
            dependencies,
            auth: options.auth,
          })
        : undefined,
      isRemoteUrl(pairedVideoUrl)
        ? migrateAsset({
            userId,
            uuid,
            sourceUrl: pairedVideoUrl,
            directory: 'paired-videos',
            filename: stringDetail(details, 'pairedVideoFilename'),
            declaredType: stringDetail(details, 'pairedVideoMimetype'),
            role: 'pairedVideo',
            uploadedKeys,
            maxVideoUploadSizeMB: policy.maxVideoUploadSizeMB,
            canUploadVideo: policy.canUploadVideo,
            dependencies,
            auth: options.auth,
          })
        : undefined,
    ]);
    const companionFailure = companionResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (companionFailure) throw companionFailure.reason;
    const [compressed, poster, pairedVideo] = companionResults.map((result) =>
      result.status === 'fulfilled' ? result.value : undefined
    );

    if (pairedVideo && mediaKind !== 'image') {
      throw new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
    }

    const [finalized] = await dependencies.finalizeAttachmentUploads({
      userId,
      scopes: ['video:upload'],
      attachments: [
        {
          uuid,
          originalKey: original.key,
          compressedKey: compressed?.key,
          posterKey: poster?.key,
          pairedVideoKey: pairedVideo?.key,
          pairedVideoSize: pairedVideo?.size,
          pairedVideoMimetype: pairedVideo?.contentType,
          pairedVideoFilename: stringDetail(details, 'pairedVideoFilename'),
          size: original.size,
          mimetype: original.contentType,
          mediaKind: pairedVideo ? 'livePhoto' : mediaKind,
        },
      ],
    });
    if (!finalized) throw new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
    return finalized;
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => dependencies.removeObject(key)));
    if (error instanceof RemoteAttachmentMigrationError) throw error;
    throw mapMigrationError(error);
  }
}

async function migrateAsset({
  userId,
  uuid,
  sourceUrl,
  directory,
  filename,
  declaredType,
  role,
  uploadedKeys,
  maxVideoUploadSizeMB,
  canUploadVideo,
  dependencies,
  auth,
}: {
  userId: string;
  uuid: string;
  sourceUrl: string;
  directory: 'uploads' | 'compressed' | 'posters' | 'paired-videos';
  filename?: string;
  declaredType?: string;
  role: AssetRole;
  uploadedKeys: string[];
  maxVideoUploadSizeMB: number;
  canUploadVideo: boolean;
  dependencies: MigrationDependencies;
  auth?: MigrationOptions['auth'];
}) {
  return globalTransferLimiter(async () => {
    const response = await fetchSafe(sourceUrl, dependencies, auth);
    const contentType = normalizeContentType(response.headers.get('content-type') || declaredType);
    if (!contentType)
      throw new RemoteAttachmentMigrationError('remote_attachment_unsupported', 422);
    validateContentType(contentType);
    validateRole(role, contentType);
    if (isVideoContentType(contentType) && !canUploadVideo) {
      throw new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
    }

    const maxSize = isVideoContentType(contentType)
      ? getMaxVideoUploadSizeBytes(maxVideoUploadSizeMB)
      : MAX_IMAGE_FILE_SIZE;
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxSize) {
      throw new RemoteAttachmentMigrationError('remote_attachment_too_large', 413);
    }

    const extension = getUploadExtension(
      filename ?? filenameFromUrl(response.url || sourceUrl),
      contentType
    );
    const key = `users/${userId}/${directory}/${uuid}${extension}`;
    let size = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.byteLength;
        if (size > maxSize) {
          callback(new RemoteAttachmentMigrationError('remote_attachment_too_large', 413));
          return;
        }
        callback(null, chunk);
      },
    });
    const source = Readable.fromWeb(response.body as never);
    limiter.once('error', () => source.destroy());
    await dependencies.storeObjectStream(key, source.pipe(limiter), contentType).catch(() => {
      throw new RemoteAttachmentMigrationError('remote_attachment_storage_unavailable', 503);
    });
    uploadedKeys.push(key);
    if (size === 0) throw new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
    return { key, size, contentType };
  });
}

async function fetchSafe(
  initialUrl: string,
  dependencies: MigrationDependencies,
  auth?: MigrationOptions['auth']
) {
  let currentUrl = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    await dependencies.assertSafeOutboundUrl(currentUrl, 'Remote attachment URL');
    let response: Response;
    try {
      const headers: Record<string, string> = { Accept: 'image/*,video/*' };
      if (auth?.bearerToken && sameOrigin(currentUrl, auth.baseUrl)) {
        headers.Authorization = `Bearer ${auth.bearerToken}`;
      }
      response = await dependencies.fetcher(currentUrl, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
    } catch {
      throw new RemoteAttachmentMigrationError('remote_attachment_download_failed', 502);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) {
        throw new RemoteAttachmentMigrationError('remote_attachment_download_failed', 502);
      }
      await response.body?.cancel();
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok || !response.body) {
      throw new RemoteAttachmentMigrationError('remote_attachment_download_failed', 502);
    }
    return response;
  }
  throw new RemoteAttachmentMigrationError('remote_attachment_download_failed', 502);
}

function sameOrigin(value: string, baseUrl: string) {
  try {
    return new URL(value).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function validateRole(role: AssetRole, contentType: string) {
  if ((role === 'compressed' || role === 'poster') && !isImageContentType(contentType)) {
    throw new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
  }
  if (role === 'pairedVideo' && !isVideoContentType(contentType)) {
    throw new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
  }
}

export function createRemoteAttachmentLimiter(limit: number, maxQueue: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) {
      if (queue.length >= maxQueue) {
        throw new RemoteAttachmentMigrationError('remote_attachment_busy', 429);
      }
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

function readGlobalConcurrency() {
  const value = Number(process.env.IMPORT_ATTACHMENT_GLOBAL_CONCURRENCY);
  return Number.isInteger(value) && value > 0 && value <= 128 ? value : DEFAULT_GLOBAL_CONCURRENCY;
}

function mapMigrationError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('size') || message.includes('large')) {
    return new RemoteAttachmentMigrationError('remote_attachment_too_large', 413);
  }
  if (message.includes('content type') || message.includes('media')) {
    return new RemoteAttachmentMigrationError('remote_attachment_unsupported', 422);
  }
  return new RemoteAttachmentMigrationError('remote_attachment_invalid', 422);
}

function isRemoteUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//iu.test(value);
}

function distinctRemoteUrl(value: string | undefined, original: string) {
  return isRemoteUrl(value) && value !== original ? value : undefined;
}

function normalizeContentType(value: string | null | undefined) {
  return value?.split(';', 1)[0].trim().toLowerCase() || undefined;
}

function stringDetail(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function filenameFromUrl(value: string) {
  try {
    return decodeURIComponent(new URL(value).pathname.split('/').pop() || 'attachment');
  } catch {
    return 'attachment';
  }
}
