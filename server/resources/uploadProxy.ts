import { createHmac, timingSafeEqual } from 'node:crypto';
import { Transform, Readable } from 'node:stream';
import type { SecurityConfig } from '../types/config';
import { getGlobalConfig } from '../utils/config';
import { storeObjectStream } from '../utils/r2';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from './errors';

const MAX_DERIVED_BYTES = 20 * 1024 * 1024;

type Payload = {
  reservationId: string;
  userId: string;
  role: 'compressed' | 'poster';
  key: string;
  contentType: string;
  maxBytes: number;
  expiresAt: number;
};

function secret(): string {
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config?.jwtSecret) throw new Error('Security configuration is required');
  return config.jwtSecret;
}

export function createDerivedUploadProxyUrl(input: {
  reservationId: string;
  userId: string;
  role: 'compressed' | 'poster';
  key: string;
  contentType: string;
  expiresAt: Date;
}): string {
  const payload: Payload = {
    reservationId: input.reservationId,
    userId: input.userId,
    role: input.role,
    key: input.key,
    contentType: input.contentType,
    maxBytes: MAX_DERIVED_BYTES,
    expiresAt: input.expiresAt.getTime(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(encoded).digest('base64url');
  const origin = process.env.RESOURCE_UPLOAD_PROXY_ORIGIN ?? 'https://api.rote.ink';
  return `${origin}/v2/api/attachments/upload-proxy?token=${encoded}.${signature}`;
}

function parseToken(token: string): Payload {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature)
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  const expected = createHmac('sha256', secret()).update(encoded).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Payload;
  if (
    typeof payload.key !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(payload.reservationId) ||
    !/^[0-9a-f-]{36}$/i.test(payload.userId) ||
    !['compressed', 'poster'].includes(payload.role) ||
    !payload.key.startsWith(`users/${payload.userId}/staging/${payload.reservationId}/`) ||
    typeof payload.contentType !== 'string' ||
    payload.maxBytes !== MAX_DERIVED_BYTES ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt <= Date.now()
  ) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired);
  }
  return payload;
}

export async function uploadDerivedObject(token: string, request: Request): Promise<void> {
  const payload = parseToken(token);
  if (request.headers.get('content-type')?.split(';', 1)[0] !== payload.contentType) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  if (!request.body) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.byteLength;
      callback(
        bytes > payload.maxBytes
          ? new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch, 413)
          : null,
        chunk
      );
    },
  });
  await storeObjectStream(
    payload.key,
    Readable.fromWeb(request.body as never).pipe(limiter),
    payload.contentType
  );
}
