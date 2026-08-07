export class BillingBodyTooLargeError extends Error {
  constructor() {
    super('Billing request body exceeds the configured limit');
    this.name = 'BillingBodyTooLargeError';
  }
}

function declaredLengthExceedsLimit(request: Request, maxBytes: number): boolean {
  const value = request.headers.get('content-length');
  if (value === null || !/^(0|[1-9][0-9]*)$/.test(value)) return false;
  return BigInt(value) > BigInt(maxBytes);
}

export async function readBillingRequestBody(
  request: Request,
  maxBytes: number
): Promise<Uint8Array> {
  if (declaredLengthExceedsLimit(request, maxBytes)) {
    await request.body?.cancel();
    throw new BillingBodyTooLargeError();
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new BillingBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
