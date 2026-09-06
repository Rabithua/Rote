import type { AiConfig } from '../types/config';

export const AI_CHAT_PERMISSION_REQUIRED_MESSAGE = 'capability_required:ai.chat';
export const AI_MEMORY_UNAVAILABLE_MESSAGE = 'Memory tools are not ready';

type AiAccessUser = {
  id: string;
};

export async function getUserAiAccess(user: AiAccessUser) {
  const { getEffectiveCapabilitiesForUser } = await import('./capabilityService');
  const effective = await getEffectiveCapabilitiesForUser(user.id);
  return {
    chatAllowed: effective.capabilities['ai.chat'].allowed,
  };
}

type AiAccess = Awaited<ReturnType<typeof getUserAiAccess>>;
type PgvectorStatus = {
  available: boolean;
  installed: boolean;
  version: string | null;
  indexName: string | null;
  dimensions: number | null;
  ready: boolean;
};

export function getAiAccessErrorFromAccess(access: AiAccess): string | null {
  if (!access.chatAllowed) return AI_CHAT_PERMISSION_REQUIRED_MESSAGE;
  return null;
}

export async function getAiAccessError(user: AiAccessUser): Promise<string | null> {
  return getAiAccessErrorFromAccess(await getUserAiAccess(user));
}

export function isAiMemoryAvailableForAccess(params: {
  access: AiAccess;
  config: AiConfig;
  vectorStatus: PgvectorStatus;
}): boolean {
  return (
    getAiAccessErrorFromAccess(params.access) === null &&
    params.config.enabled === true &&
    params.config.vectorEnabled === true &&
    params.vectorStatus.installed === true &&
    params.vectorStatus.ready === true
  );
}

export async function getAiMemoryAccessError(user: AiAccessUser): Promise<string | null> {
  const { getPgvectorStatus, getStoredAiConfig } = await import('../utils/dbMethods/ai');
  const [access, config, vectorStatus] = await Promise.all([
    getUserAiAccess(user),
    getStoredAiConfig(),
    getPgvectorStatus(),
  ]);
  const accessError = getAiAccessErrorFromAccess(access);
  if (accessError) return accessError;
  return isAiMemoryAvailableForAccess({ access, config, vectorStatus })
    ? null
    : AI_MEMORY_UNAVAILABLE_MESSAGE;
}
