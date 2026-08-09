import { z } from 'zod';

export const BILLING_ALLOWED_PRODUCT_IDS = [
  'ink.rote.pro.monthly',
  'ink.rote.pro.quarterly',
  'ink.rote.pro.yearly',
] as const;

export const BILLING_ISSUER = 'rote-paid-server';
export const BILLING_OFFICIAL_INSTANCE_ID = 'rote-official';
export const BILLING_OFFICIAL_ORIGIN = 'https://api.rote.ink';
export const BILLING_DEFAULT_CONNECT_TIMEOUT_MS = 3_000;
export const BILLING_DEFAULT_TOTAL_TIMEOUT_MS = 10_000;

export type BillingProductId = (typeof BILLING_ALLOWED_PRODUCT_IDS)[number];

export type BillingSigningKey = {
  keyId: string;
  secret: string | Uint8Array;
};

export type BillingSigningKeys = {
  active: BillingSigningKey;
  previous?: BillingSigningKey;
};

export type BillingConfig =
  | { enabled: false }
  | {
      enabled: true;
      instanceId: string;
      officialOrigin: string;
      paidServerUrl: string;
      productIds: BillingProductId[];
      connectTimeoutMs: number;
      totalTimeoutMs: number;
      roteToPaid: BillingSigningKeys;
      paidToRote: BillingSigningKeys;
    };

const enabledConfigSchema = z.object({
  BILLING_INSTANCE_ID: z.string().trim().min(1),
  BILLING_OFFICIAL_ORIGIN: z.string().trim().min(1),
  BILLING_PAID_SERVER_URL: z.string().trim().min(1),
  BILLING_PRODUCT_IDS: z.string().trim().min(1),
  BILLING_PAID_CONNECT_TIMEOUT_MS: z.string().trim().min(1).optional(),
  BILLING_PAID_TOTAL_TIMEOUT_MS: z.string().trim().min(1).optional(),
  BILLING_ROTE_TO_PAID_ACTIVE_KEY_ID: z.string().trim().min(1),
  BILLING_ROTE_TO_PAID_ACTIVE_SECRET: z.string().min(32),
  BILLING_ROTE_TO_PAID_PREVIOUS_KEY_ID: z.string().trim().min(1).optional(),
  BILLING_ROTE_TO_PAID_PREVIOUS_SECRET: z.string().min(32).optional(),
  BILLING_PAID_TO_ROTE_ACTIVE_KEY_ID: z.string().trim().min(1),
  BILLING_PAID_TO_ROTE_ACTIVE_SECRET: z.string().min(32),
  BILLING_PAID_TO_ROTE_PREVIOUS_KEY_ID: z.string().trim().min(1).optional(),
  BILLING_PAID_TO_ROTE_PREVIOUS_SECRET: z.string().min(32).optional(),
});

function optionalEnvironmentValue(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

function parseEnabled(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('BILLING_ENABLED must be either true or false');
}

function parseHttpsOrigin(value: string, environmentKey: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${environmentKey} must be an exact HTTPS origin`);
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    value !== url.origin
  ) {
    throw new Error(`${environmentKey} must be an exact HTTPS origin`);
  }

  return url.origin;
}

function parseProducts(value: string): BillingProductId[] {
  const productIds = value.split(',').map((productId) => productId.trim());
  if (productIds.some((productId) => !productId)) {
    throw new Error('BILLING_PRODUCT_IDS must not contain empty values');
  }
  if (new Set(productIds).size !== productIds.length) {
    throw new Error('BILLING_PRODUCT_IDS must not contain duplicate values');
  }
  if (
    productIds.some(
      (productId) => !BILLING_ALLOWED_PRODUCT_IDS.includes(productId as BillingProductId)
    )
  ) {
    throw new Error('BILLING_PRODUCT_IDS contains a product that is not compiled into Rote');
  }
  return productIds as BillingProductId[];
}

function parseTimeout(value: string | undefined, fallback: number, environmentKey: string): number {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${environmentKey} must be a positive integer`);
  }
  const milliseconds = Number(value);
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error(`${environmentKey} must be a safe integer`);
  }
  return milliseconds;
}

function parseSigningKeys(params: {
  activeKeyId: string;
  activeSecret: string;
  previousKeyId?: string;
  previousSecret?: string;
  direction: string;
}): BillingSigningKeys {
  const hasPreviousKeyId = params.previousKeyId !== undefined;
  const hasPreviousSecret = params.previousSecret !== undefined;
  if (hasPreviousKeyId !== hasPreviousSecret) {
    throw new Error(`${params.direction} previous key ID and secret must be configured together`);
  }
  if (params.previousKeyId === params.activeKeyId) {
    throw new Error(`${params.direction} active and previous key IDs must be different`);
  }

  return {
    active: { keyId: params.activeKeyId, secret: params.activeSecret },
    ...(params.previousKeyId && params.previousSecret
      ? { previous: { keyId: params.previousKeyId, secret: params.previousSecret } }
      : {}),
  };
}

function assertDirectionSecretsDiffer(
  roteToPaid: BillingSigningKeys,
  paidToRote: BillingSigningKeys
): void {
  const isConfiguredSecret = (
    secret: string | Uint8Array | undefined
  ): secret is string | Uint8Array => secret !== undefined;
  const outboundSecrets = [roteToPaid.active.secret, roteToPaid.previous?.secret].filter(
    isConfiguredSecret
  );
  const inboundSecrets = [paidToRote.active.secret, paidToRote.previous?.secret].filter(
    isConfiguredSecret
  );
  const asBytes = (secret: string | Uint8Array) =>
    typeof secret === 'string' ? Buffer.from(secret, 'utf8') : Buffer.from(secret);
  if (
    outboundSecrets.some((outboundSecret) =>
      inboundSecrets.some((inboundSecret) => asBytes(outboundSecret).equals(asBytes(inboundSecret)))
    )
  ) {
    throw new Error('Rote-to-Paid and Paid-to-Rote secrets must be different');
  }
}

export function loadBillingConfig(environment: NodeJS.ProcessEnv = process.env): BillingConfig {
  if (!parseEnabled(environment.BILLING_ENABLED)) return { enabled: false };

  const raw = enabledConfigSchema.parse({
    BILLING_INSTANCE_ID: environment.BILLING_INSTANCE_ID,
    BILLING_OFFICIAL_ORIGIN: environment.BILLING_OFFICIAL_ORIGIN,
    BILLING_PAID_SERVER_URL: environment.BILLING_PAID_SERVER_URL,
    BILLING_PRODUCT_IDS: environment.BILLING_PRODUCT_IDS,
    BILLING_PAID_CONNECT_TIMEOUT_MS: optionalEnvironmentValue(
      environment.BILLING_PAID_CONNECT_TIMEOUT_MS
    ),
    BILLING_PAID_TOTAL_TIMEOUT_MS: optionalEnvironmentValue(
      environment.BILLING_PAID_TOTAL_TIMEOUT_MS
    ),
    BILLING_ROTE_TO_PAID_ACTIVE_KEY_ID: environment.BILLING_ROTE_TO_PAID_ACTIVE_KEY_ID,
    BILLING_ROTE_TO_PAID_ACTIVE_SECRET: environment.BILLING_ROTE_TO_PAID_ACTIVE_SECRET,
    BILLING_ROTE_TO_PAID_PREVIOUS_KEY_ID: optionalEnvironmentValue(
      environment.BILLING_ROTE_TO_PAID_PREVIOUS_KEY_ID
    ),
    BILLING_ROTE_TO_PAID_PREVIOUS_SECRET: optionalEnvironmentValue(
      environment.BILLING_ROTE_TO_PAID_PREVIOUS_SECRET
    ),
    BILLING_PAID_TO_ROTE_ACTIVE_KEY_ID: environment.BILLING_PAID_TO_ROTE_ACTIVE_KEY_ID,
    BILLING_PAID_TO_ROTE_ACTIVE_SECRET: environment.BILLING_PAID_TO_ROTE_ACTIVE_SECRET,
    BILLING_PAID_TO_ROTE_PREVIOUS_KEY_ID: optionalEnvironmentValue(
      environment.BILLING_PAID_TO_ROTE_PREVIOUS_KEY_ID
    ),
    BILLING_PAID_TO_ROTE_PREVIOUS_SECRET: optionalEnvironmentValue(
      environment.BILLING_PAID_TO_ROTE_PREVIOUS_SECRET
    ),
  });

  if (raw.BILLING_INSTANCE_ID !== BILLING_OFFICIAL_INSTANCE_ID) {
    throw new Error(`BILLING_INSTANCE_ID must be ${BILLING_OFFICIAL_INSTANCE_ID}`);
  }
  const officialOrigin = parseHttpsOrigin(raw.BILLING_OFFICIAL_ORIGIN, 'BILLING_OFFICIAL_ORIGIN');
  if (officialOrigin !== BILLING_OFFICIAL_ORIGIN) {
    throw new Error(`BILLING_OFFICIAL_ORIGIN must be ${BILLING_OFFICIAL_ORIGIN}`);
  }
  const connectTimeoutMs = parseTimeout(
    raw.BILLING_PAID_CONNECT_TIMEOUT_MS,
    BILLING_DEFAULT_CONNECT_TIMEOUT_MS,
    'BILLING_PAID_CONNECT_TIMEOUT_MS'
  );
  const totalTimeoutMs = parseTimeout(
    raw.BILLING_PAID_TOTAL_TIMEOUT_MS,
    BILLING_DEFAULT_TOTAL_TIMEOUT_MS,
    'BILLING_PAID_TOTAL_TIMEOUT_MS'
  );
  if (connectTimeoutMs > totalTimeoutMs) {
    throw new Error('BILLING_PAID_CONNECT_TIMEOUT_MS must not exceed total timeout');
  }

  const roteToPaid = parseSigningKeys({
    activeKeyId: raw.BILLING_ROTE_TO_PAID_ACTIVE_KEY_ID,
    activeSecret: raw.BILLING_ROTE_TO_PAID_ACTIVE_SECRET,
    previousKeyId: raw.BILLING_ROTE_TO_PAID_PREVIOUS_KEY_ID,
    previousSecret: raw.BILLING_ROTE_TO_PAID_PREVIOUS_SECRET,
    direction: 'Rote-to-Paid',
  });
  const paidToRote = parseSigningKeys({
    activeKeyId: raw.BILLING_PAID_TO_ROTE_ACTIVE_KEY_ID,
    activeSecret: raw.BILLING_PAID_TO_ROTE_ACTIVE_SECRET,
    previousKeyId: raw.BILLING_PAID_TO_ROTE_PREVIOUS_KEY_ID,
    previousSecret: raw.BILLING_PAID_TO_ROTE_PREVIOUS_SECRET,
    direction: 'Paid-to-Rote',
  });
  assertDirectionSecretsDiffer(roteToPaid, paidToRote);

  return {
    enabled: true,
    instanceId: raw.BILLING_INSTANCE_ID,
    officialOrigin,
    paidServerUrl: parseHttpsOrigin(raw.BILLING_PAID_SERVER_URL, 'BILLING_PAID_SERVER_URL'),
    productIds: parseProducts(raw.BILLING_PRODUCT_IDS),
    connectTimeoutMs,
    totalTimeoutMs,
    roteToPaid,
    paidToRote,
  };
}
