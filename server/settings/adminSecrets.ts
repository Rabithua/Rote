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
