import type { BillingConfig } from './config';
import { createBillingRequestId } from './requestId';
import { BILLING_SIGNATURE_HEADERS, signBillingRequest } from './signature';

const MAX_PAID_RESPONSE_BYTES = 256 * 1024;

export type EnabledBillingConfig = Extract<BillingConfig, { enabled: true }>;
export type BillingFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type PaidTransportErrorKind =
  | 'connection_timeout'
  | 'total_timeout'
  | 'network_error'
  | 'invalid_response';

export class PaidTransportError extends Error {
  constructor(public readonly kind: PaidTransportErrorKind) {
    super(`Paid billing transport failed: ${kind}`);
    this.name = 'PaidTransportError';
  }
}

export type PaidTransportResponse = {
  requestId: string;
  status: number;
  body: unknown;
};

async function readLimitedResponseBody(response: Response): Promise<string> {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength !== null &&
    /^(0|[1-9][0-9]*)$/.test(declaredLength) &&
    BigInt(declaredLength) > BigInt(MAX_PAID_RESPONSE_BYTES)
  ) {
    await response.body?.cancel();
    throw new PaidTransportError('invalid_response');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PAID_RESPONSE_BYTES) {
        await reader.cancel();
        throw new PaidTransportError('invalid_response');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new PaidTransportError('invalid_response');
  }
}

export class PaidBillingTransport {
  private readonly fetch: BillingFetch;
  private readonly now: () => Date;
  private readonly requestId: () => string;

  constructor(
    private readonly config: EnabledBillingConfig,
    dependencies: {
      fetch?: BillingFetch;
      now?: () => Date;
      requestId?: () => string;
    } = {}
  ) {
    this.fetch = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = dependencies.now ?? (() => new Date());
    this.requestId = dependencies.requestId ?? (() => createBillingRequestId());
  }

  async postJson(
    path: string,
    serializeBody: (requestId: string) => string
  ): Promise<PaidTransportResponse> {
    if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
      throw new Error('Paid billing path must be an absolute path without query or fragment');
    }
    const paidServerOrigin = new URL(this.config.paidServerUrl).origin;
    const requestUrl = new URL(path, this.config.paidServerUrl);
    if (requestUrl.origin !== paidServerOrigin) {
      throw new Error('Paid billing path must stay on the configured Paid origin');
    }

    const requestId = this.requestId();
    const body = serializeBody(requestId);
    const now = this.now();
    const timestamp = Math.floor(now.getTime() / 1000).toString();
    const signed = signBillingRequest({
      key: this.config.roteToPaid.active,
      method: 'POST',
      pathAndQuery: path,
      timestamp,
      requestId,
      body,
    });
    const controller = new AbortController();
    let timeoutKind: Extract<PaidTransportErrorKind, `${string}_timeout`> | null = null;
    let rejectConnection!: (reason: PaidTransportError) => void;
    let rejectTotal!: (reason: PaidTransportError) => void;
    const connectionTimeout = new Promise<never>((_resolve, reject) => {
      rejectConnection = reject;
    });
    const totalTimeout = new Promise<never>((_resolve, reject) => {
      rejectTotal = reject;
    });
    const connectTimer = setTimeout(() => {
      timeoutKind = 'connection_timeout';
      controller.abort();
      rejectConnection(new PaidTransportError('connection_timeout'));
    }, this.config.connectTimeoutMs);
    const totalTimer = setTimeout(() => {
      timeoutKind = 'total_timeout';
      controller.abort();
      rejectTotal(new PaidTransportError('total_timeout'));
    }, this.config.totalTimeoutMs);

    try {
      const response = await Promise.race([
        this.fetch(requestUrl, {
          method: 'POST',
          redirect: 'error',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            [BILLING_SIGNATURE_HEADERS.keyId]: this.config.roteToPaid.active.keyId,
            [BILLING_SIGNATURE_HEADERS.timestamp]: timestamp,
            [BILLING_SIGNATURE_HEADERS.requestId]: requestId,
            [BILLING_SIGNATURE_HEADERS.signature]: signed.signature,
          },
          body,
          signal: controller.signal,
        }),
        connectionTimeout,
        totalTimeout,
      ]);
      clearTimeout(connectTimer);

      if (response.redirected || (response.status >= 300 && response.status < 400)) {
        await response.body?.cancel();
        throw new PaidTransportError('invalid_response');
      }

      const responseText = await Promise.race([readLimitedResponseBody(response), totalTimeout]);
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        throw new PaidTransportError('invalid_response');
      }
      return { requestId, status: response.status, body: responseBody };
    } catch (error) {
      if (error instanceof PaidTransportError) throw error;
      if (timeoutKind) throw new PaidTransportError(timeoutKind);
      throw new PaidTransportError('network_error');
    } finally {
      clearTimeout(connectTimer);
      clearTimeout(totalTimer);
    }
  }
}
