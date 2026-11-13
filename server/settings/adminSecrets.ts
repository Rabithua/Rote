// Instance-level credential masking for admin settings reads and the
// placeholder-keep / role-gate rules for writes. Ordinary admins must never
// receive real credential material — the boundary set when admin settings
// stopped returning JWT signing keys. The placeholder round-trips through the
// admin UI (same convention as MASKED_API_KEY) so unchanged secrets survive
// saves.

export const MASKED_SECRET = '********';

type SecretRecord = Record<string, any>;

export function maskStorageSecretForAdmin<T extends Record<string, any>>(config: T): T {
  if (!config || typeof config.secretAccessKey !== 'string' || !config.secretAccessKey) {
    return config;
  }
  return { ...config, secretAccessKey: MASKED_SECRET };
}

export function maskOAuthProviderSecrets(provider: SecretRecord): SecretRecord {
  const next = { ...provider };
  if (typeof next.clientSecret === 'string' && next.clientSecret) {
    next.clientSecret = MASKED_SECRET;
  }
  if (typeof next.privateKey === 'string' && next.privateKey) {
    next.privateKey = MASKED_SECRET;
  }
  return next;
}

export function maskOAuthSecretsForAdmin(
  oauth: SecretRecord | undefined | null
): SecretRecord | undefined | null {
  if (
    !oauth ||
    typeof oauth !== 'object' ||
    !oauth.providers ||
    typeof oauth.providers !== 'object'
  ) {
    return oauth;
  }
  const providers: SecretRecord = {};
  for (const [name, provider] of Object.entries(oauth.providers as SecretRecord)) {
    providers[name] =
      provider && typeof provider === 'object' ? maskOAuthProviderSecrets(provider) : provider;
  }
  return { ...oauth, providers };
}

const oauthCredentialFields = ['clientSecret', 'privateKey'] as const;

function existingValue(field: string, prior: SecretRecord): string | undefined {
  const value = prior[field];
  return typeof value === 'string' && value ? value : undefined;
}

/// 判定补丁是否试图更改 provider 凭据或回调地址；掩码占位符与未变更值不算更改
export function oauthProviderCredentialChanges(
  oauthUpdate: SecretRecord | undefined | null,
  existing: SecretRecord | undefined | null
): boolean {
  if (!oauthUpdate || typeof oauthUpdate !== 'object' || !oauthUpdate.providers) return false;
  const existingProviders = (existing?.oauth?.providers || {}) as SecretRecord;
  for (const [name, entry] of Object.entries(oauthUpdate.providers as SecretRecord)) {
    if (!entry || typeof entry !== 'object') continue;
    const prior = (existingProviders[name] || {}) as SecretRecord;
    const priorCallbackUrl = existingValue('callbackUrl', prior);
    if (typeof entry.callbackUrl === 'string' && entry.callbackUrl !== priorCallbackUrl) {
      return true;
    }
    for (const field of oauthCredentialFields) {
      const value = (entry as SecretRecord)[field];
      if (typeof value !== 'string' || !value || value === MASKED_SECRET) continue;
      if (value !== existingValue(field, prior)) return true;
    }
  }
  return false;
}

/// 掩码占位符/空值还原为服务器已存的真实凭据（占位符经管理端 UI 原样回传）
export function resolveMaskedOAuthProviderSecrets(
  oauthUpdate: SecretRecord | undefined | null,
  existing: SecretRecord | undefined | null
): SecretRecord | undefined | null {
  if (!oauthUpdate || typeof oauthUpdate !== 'object' || !oauthUpdate.providers) return oauthUpdate;
  const existingProviders = (existing?.oauth?.providers || {}) as SecretRecord;
  const providers: SecretRecord = {};
  for (const [name, entry] of Object.entries(oauthUpdate.providers as SecretRecord)) {
    if (!entry || typeof entry !== 'object') {
      providers[name] = entry;
      continue;
    }
    const prior = (existingProviders[name] || {}) as SecretRecord;
    const next = { ...entry };
    for (const field of oauthCredentialFields) {
      const priorValue = existingValue(field, prior);
      const value = next[field];
      if ((value === MASKED_SECRET || value === '' || value === undefined) && priorValue) {
        next[field] = priorValue;
      }
    }
    providers[name] = next;
  }
  return { ...oauthUpdate, providers };
}

/// 掩码/空 secret 还原为已存的存储密钥；无已存值时返回 undefined
/// （调用方按配置不完整处理，避免把占位符持久化）
export function resolveStorageSecret(
  incoming: SecretRecord | undefined | null,
  existing: SecretRecord | undefined | null
): string | undefined {
  const incomingSecret = incoming?.secretAccessKey;
  if (typeof incomingSecret === 'string' && incomingSecret && incomingSecret !== MASKED_SECRET) {
    return incomingSecret;
  }
  return existingValue('secretAccessKey', (existing || {}) as SecretRecord);
}

/// notification 组：vapidPrivateKey + bark key + http headers 属于实例级机密
export function maskNotificationSecretsForAdmin(
  config: SecretRecord | undefined | null
): SecretRecord | undefined | null {
  if (!config || typeof config !== 'object') return config;
  const next = { ...config };
  if (typeof next.vapidPrivateKey === 'string' && next.vapidPrivateKey) {
    next.vapidPrivateKey = MASKED_SECRET;
  }
  if (next.adminHooks && typeof next.adminHooks === 'object') {
    const hooks = next.adminHooks as SecretRecord;
    if (Array.isArray(hooks.channels)) {
      next.adminHooks = {
        ...hooks,
        channels: hooks.channels.map(maskHookChannelSecrets),
      };
    }
  }
  return next;
}

function maskHookChannelSecrets(channel: SecretRecord): SecretRecord {
  const next = { ...channel };
  if (typeof next.key === 'string' && next.key) next.key = MASKED_SECRET;
  if (next.headers && typeof next.headers === 'object') {
    // 整组头视为机密；保存时占位符还原为已存头
    next.headers = MASKED_SECRET;
  }
  return next;
}

export function resolveNotificationSecrets(
  incoming: SecretRecord | undefined | null,
  existing: SecretRecord | undefined | null
): SecretRecord | undefined | null {
  if (!incoming || typeof incoming !== 'object') return incoming;
  const prior = existing && typeof existing === 'object' ? existing : {};
  const next = { ...incoming };

  if (
    (next.vapidPrivateKey === MASKED_SECRET ||
      next.vapidPrivateKey === '' ||
      next.vapidPrivateKey === undefined) &&
    typeof prior.vapidPrivateKey === 'string' &&
    prior.vapidPrivateKey
  ) {
    next.vapidPrivateKey = prior.vapidPrivateKey;
  }

  const priorHooks = prior.adminHooks as SecretRecord | undefined;
  const incomingHooks = next.adminHooks as SecretRecord | undefined;
  if (incomingHooks && typeof incomingHooks === 'object' && Array.isArray(incomingHooks.channels)) {
    const priorChannels = Array.isArray(priorHooks?.channels)
      ? (priorHooks.channels as SecretRecord[])
      : [];
    const priorById = new Map(priorChannels.map((channel) => [channel.id, channel]));
    next.adminHooks = {
      ...incomingHooks,
      channels: incomingHooks.channels.map((channel) => {
        const ch = channel as SecretRecord;
        if (!ch || typeof ch !== 'object') return channel;
        const priorChannel = priorById.get(ch.id) as SecretRecord | undefined;
        const resolved = { ...ch };
        if (
          (resolved.key === MASKED_SECRET || resolved.key === '' || resolved.key === undefined) &&
          typeof priorChannel?.key === 'string' &&
          priorChannel.key
        ) {
          resolved.key = priorChannel.key;
        }
        if (
          resolved.headers === MASKED_SECRET &&
          priorChannel?.headers &&
          typeof priorChannel.headers === 'object'
        ) {
          resolved.headers = priorChannel.headers;
        }
        return resolved;
      }),
    };
  }
  return next;
}
