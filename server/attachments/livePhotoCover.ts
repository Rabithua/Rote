import { Worker } from 'node:worker_threads';
import { MAX_FILES } from '../utils/fileValidation';
import { getObjectBytes, getObjectInfo, putObjectBytes } from '../utils/r2';
import { assertHeifImageDimensions } from './livePhotoCoverCodec';
import { extractOriginalUploadUuid } from './uploadKeys';

export const LIVE_PHOTO_COVER_CONTENT_TYPE = 'image/jpeg';
export const LIVE_PHOTO_COVER_FORMAT = 'jpeg';
export const MAX_LIVE_PHOTOS_PER_FINALIZE = MAX_FILES;

const MAX_CONCURRENT_LIVE_PHOTO_COVER_WORKERS = 2;
const LIVE_PHOTO_COVER_WORKER_TIMEOUT_MS = 30_000;
const coverWorkerQueue: Array<() => void> = [];
let activeCoverWorkers = 0;

export type LivePhotoCoverStorage = {
  getInfo: typeof getObjectInfo;
  getBytes: typeof getObjectBytes;
  putBytes: typeof putObjectBytes;
};

export type LivePhotoCoverEncoder = (_input: Uint8Array) => Promise<Uint8Array>;

export type EnsureLivePhotoCoverResult = {
  contentType: typeof LIVE_PHOTO_COVER_CONTENT_TYPE;
  key: string;
  size: number;
  status: 'generated' | 'reused';
};

const defaultStorage: LivePhotoCoverStorage = {
  getInfo: getObjectInfo,
  getBytes: getObjectBytes,
  putBytes: putObjectBytes,
};

type LivePhotoFinalizeItem = {
  mediaKind?: string;
  pairedVideoKey?: string;
};

type CoverWorkerResponse = { bytes: Uint8Array; ok: true } | { error: string; ok: false };

function drainCoverWorkerQueue(): void {
  while (
    activeCoverWorkers < MAX_CONCURRENT_LIVE_PHOTO_COVER_WORKERS &&
    coverWorkerQueue.length > 0
  ) {
    coverWorkerQueue.shift()?.();
  }
}

function runWithCoverWorkerLimit<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    coverWorkerQueue.push(() => {
      activeCoverWorkers++;
      void task()
        .then(resolve, reject)
        .finally(() => {
          activeCoverWorkers--;
          drainCoverWorkerQueue();
        });
    });
    drainCoverWorkerQueue();
  });
}

function encodeInWorker(input: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(require.resolve('./livePhotoCoverWorker'));
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.removeAllListeners();
      void worker.terminate().then(callback, callback);
    };

    worker.once('message', (response: CoverWorkerResponse) => {
      if (response.ok) {
        finish(() => resolve(new Uint8Array(response.bytes)));
      } else {
        finish(() => reject(new Error(response.error)));
      }
    });
    worker.once('error', (error) => finish(() => reject(error)));
    worker.once('exit', (code) => {
      finish(() =>
        reject(new Error(`Live Photo cover worker exited before producing output (code ${code})`))
      );
    });
    const timeout = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            `Live Photo cover worker exceeded ${LIVE_PHOTO_COVER_WORKER_TIMEOUT_MS}ms timeout`
          )
        )
      );
    }, LIVE_PHOTO_COVER_WORKER_TIMEOUT_MS);
    worker.postMessage(input);
  });
}

export function assertLivePhotoFinalizeBatch(items: LivePhotoFinalizeItem[]): void {
  const livePhotoCount = items.filter(
    (item) => item.mediaKind === 'livePhoto' || Boolean(item.pairedVideoKey)
  ).length;
  if (livePhotoCount > MAX_LIVE_PHOTOS_PER_FINALIZE) {
    throw new Error(`Maximum ${MAX_LIVE_PHOTOS_PER_FINALIZE} Live Photos can be finalized at once`);
  }
}

export function isJpeg(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.byteLength - 2] === 0xff &&
    bytes[bytes.byteLength - 1] === 0xd9
  );
}

export function getLivePhotoCoverKey(originalKey: string): string {
  const uuid = extractOriginalUploadUuid(originalKey);
  if (!uuid) {
    throw new Error(`Cannot derive Live Photo uuid from original key: ${originalKey}`);
  }

  const userPrefixMatch = originalKey.match(/^(users\/[^/]+)\/uploads\//);
  if (!userPrefixMatch) {
    throw new Error(`Cannot derive Live Photo owner prefix from original key: ${originalKey}`);
  }
  return `${userPrefixMatch[1]}/compressed/${uuid}.jpg`;
}

export async function encodeHeicToJpeg(input: Uint8Array): Promise<Uint8Array> {
  assertHeifImageDimensions(input);
  const output = await runWithCoverWorkerLimit(() => encodeInWorker(input));
  if (!isJpeg(output)) {
    throw new Error('JPEG encoder returned bytes with an invalid signature');
  }
  return output;
}

export async function ensureLivePhotoCover(
  originalKey: string,
  dependencies: {
    encoder?: LivePhotoCoverEncoder;
    storage?: LivePhotoCoverStorage;
  } = {}
): Promise<EnsureLivePhotoCoverResult> {
  const outputKey = getLivePhotoCoverKey(originalKey);
  const storage = dependencies.storage ?? defaultStorage;
  const encoder = dependencies.encoder ?? encodeHeicToJpeg;

  try {
    const existingInfo = await storage.getInfo(outputKey);
    if (existingInfo?.contentType === LIVE_PHOTO_COVER_CONTENT_TYPE) {
      const existingBytes = await storage.getBytes(outputKey);
      if (isJpeg(existingBytes)) {
        // eslint-disable-next-line no-console
        console.info(
          `[live-photo-cover] status=reused originalKey=${originalKey} format=${LIVE_PHOTO_COVER_FORMAT} contentType=${LIVE_PHOTO_COVER_CONTENT_TYPE} outputKey=${outputKey} outputBytes=${existingBytes.byteLength}`
        );
        return {
          contentType: LIVE_PHOTO_COVER_CONTENT_TYPE,
          key: outputKey,
          size: existingBytes.byteLength,
          status: 'reused',
        };
      }
    }

    const originalBytes = await storage.getBytes(originalKey);
    const coverBytes = await encoder(originalBytes);
    if (!isJpeg(coverBytes)) {
      throw new Error('Generated cover bytes are not a JPEG');
    }

    await storage.putBytes(outputKey, coverBytes, LIVE_PHOTO_COVER_CONTENT_TYPE);
    // eslint-disable-next-line no-console
    console.info(
      `[live-photo-cover] status=generated originalKey=${originalKey} inputBytes=${originalBytes.byteLength} format=${LIVE_PHOTO_COVER_FORMAT} contentType=${LIVE_PHOTO_COVER_CONTENT_TYPE} outputKey=${outputKey} outputBytes=${coverBytes.byteLength}`
    );
    return {
      contentType: LIVE_PHOTO_COVER_CONTENT_TYPE,
      key: outputKey,
      size: coverBytes.byteLength,
      status: 'generated',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[live-photo-cover] status=failed originalKey=${originalKey} format=${LIVE_PHOTO_COVER_FORMAT} contentType=${LIVE_PHOTO_COVER_CONTENT_TYPE} outputKey=${outputKey} reason=${reason}`
    );
    throw new Error(`Failed to create Live Photo browser cover for ${originalKey}: ${reason}`);
  }
}
