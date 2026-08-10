import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { BillingSigningKey, BillingSigningKeys } from './config';

export const BILLING_SIGNATURE_CLOCK_SKEW_SECONDS = 300;

export const BILLING_SIGNATURE_HEADERS = {
  keyId: 'X-Rote-Key-Id',
  timestamp: 'X-Rote-Timestamp',
  requestId: 'X-Rote-Request-Id',
  signature: 'X-Rote-Signature',
} as const;

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNIX_SECONDS_PATTERN = /^(0|[1-9][0-9]*)$/;
const SIGNATURE_PATTERN = /^v1=([0-9a-f]{64})$/;

export type BillingSignatureHeaders = {
  keyId?: string;
  timestamp?: string;
  requestId?: string;
  signature?: string;
};

export type VerifiedBillingSignature = {
  keyId: string;
  requestId: string;
  timestamp: string;
  bodyHash: string;
  canonicalPathAndQuery: string;
  canonicalRequest: string;
};

export type BillingSignatureErrorCode =
  | 'billing_signature_headers_missing'
  | 'billing_signature_timestamp_invalid'
  | 'billing_signature_expired'
  | 'billing_signature_request_id_invalid'
  | 'billing_signature_key_unknown'
  | 'billing_signature_invalid';

export class BillingSignatureError extends Error {
  constructor(public readonly code: BillingSignatureErrorCode) {
    super(code);
    this.name = 'BillingSignatureError';
  }
}

export function isBillingRequestId(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}

function encodeCanonicalQueryComponent(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function canonicalizePathAndQuery(input: string | URL): string {
  const url = input instanceof URL ? input : new URL(input, 'https://billing.invalid');
  const query = [...url.searchParams.entries()]
    .map(
      ([key, value]) =>
        [encodeCanonicalQueryComponent(key), encodeCanonicalQueryComponent(value)] as const
    )
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyOrder = leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      return keyOrder || (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return query ? `${url.pathname}?${query}` : url.pathname;
}

export function sha256Hex(body: Uint8Array | string): string {
  return createHash('sha256').update(body).digest('hex');
}

export function buildBillingCanonicalRequest(params: {
  method: string;
  pathAndQuery: string | URL;
  timestamp: string;
  requestId: string;
  bodyHash: string;
}): string {
  return [
    'v1',
    params.method.toUpperCase(),
    canonicalizePathAndQuery(params.pathAndQuery),
    params.timestamp,
    params.requestId,
    params.bodyHash,
  ].join('\n');
}

export function signBillingRequest(params: {
  key: Omit<BillingSigningKey, 'secret'> & { secret: string | Uint8Array };
  method: string;
  pathAndQuery: string | URL;
  timestamp: string;
  requestId: string;
  body: Uint8Array | string;
}): {
  bodyHash: string;
  canonicalRequest: string;
  signature: string;
} {
  const bodyHash = sha256Hex(params.body);
  const canonicalRequest = buildBillingCanonicalRequest({
    method: params.method,
    pathAndQuery: params.pathAndQuery,
    timestamp: params.timestamp,
    requestId: params.requestId,
    bodyHash,
  });
  return {
    bodyHash,
    canonicalRequest,
    signature: `v1=${createHmac('sha256', params.key.secret).update(canonicalRequest).digest('hex')}`,
  };
}

function selectVerificationKey(keys: BillingSigningKeys, keyId: string): BillingSigningKey | null {
  if (keys.active.keyId === keyId) return keys.active;
  if (keys.previous?.keyId === keyId) return keys.previous;
  return null;
}

export function verifyBillingRequest(params: {
  keys: BillingSigningKeys;
  method: string;
  pathAndQuery: string | URL;
  body: Uint8Array | string;
  headers: BillingSignatureHeaders;
  now?: Date;
}): VerifiedBillingSignature {
  const { keyId, timestamp, requestId, signature } = params.headers;
  if (!keyId || !timestamp || !requestId || !signature) {
    throw new BillingSignatureError('billing_signature_headers_missing');
  }
  if (!UNIX_SECONDS_PATTERN.test(timestamp)) {
    throw new BillingSignatureError('billing_signature_timestamp_invalid');
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) {
    throw new BillingSignatureError('billing_signature_timestamp_invalid');
  }
  const nowSeconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > BILLING_SIGNATURE_CLOCK_SKEW_SECONDS) {
    throw new BillingSignatureError('billing_signature_expired');
  }
  if (!isBillingRequestId(requestId)) {
    throw new BillingSignatureError('billing_signature_request_id_invalid');
  }

  const key = selectVerificationKey(params.keys, keyId);
  if (!key) throw new BillingSignatureError('billing_signature_key_unknown');

  const signatureMatch = SIGNATURE_PATTERN.exec(signature);
  if (!signatureMatch) throw new BillingSignatureError('billing_signature_invalid');

  const expected = signBillingRequest({
    key,
    method: params.method,
    pathAndQuery: params.pathAndQuery,
    timestamp,
    requestId,
    body: params.body,
  });
  const actualBytes = Buffer.from(signatureMatch[1], 'hex');
  const expectedBytes = Buffer.from(expected.signature.slice(3), 'hex');
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new BillingSignatureError('billing_signature_invalid');
  }

  return {
    keyId,
    requestId,
    timestamp,
    bodyHash: expected.bodyHash,
    canonicalPathAndQuery: canonicalizePathAndQuery(params.pathAndQuery),
    canonicalRequest: expected.canonicalRequest,
  };
}
