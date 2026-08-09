import { randomBytes } from 'node:crypto';

export type BillingRequestIdOptions = {
  now?: Date;
  random?: Uint8Array;
};

function writeUnixMilliseconds(target: Uint8Array, milliseconds: number): void {
  let remaining = BigInt(milliseconds);
  for (let index = 5; index >= 0; index -= 1) {
    target[index] = Number(remaining & BigInt(0xff));
    remaining >>= BigInt(8);
  }
}

export function createBillingRequestId(options: BillingRequestIdOptions = {}): string {
  const milliseconds = (options.now ?? new Date()).getTime();
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 0xffffffffffff) {
    throw new Error('Billing request time is outside the UUIDv7 range');
  }

  const random = options.random ?? randomBytes(10);
  if (random.byteLength !== 10) {
    throw new Error('Billing UUIDv7 generation requires exactly 10 random bytes');
  }

  const bytes = new Uint8Array(16);
  writeUnixMilliseconds(bytes, milliseconds);
  bytes[6] = 0x70 | (random[0] & 0x0f);
  bytes[7] = random[1];
  bytes[8] = 0x80 | (random[2] & 0x3f);
  bytes.set(random.subarray(3), 9);

  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
