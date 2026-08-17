const PUSH_METADATA_KEY = '_push';

export type PushPayloadMetadata = {
  titleLocArgs?: string[];
  bodyLocArgs?: string[];
  reaction?: unknown;
};

function stringArguments(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return undefined;
  return value;
}

export function readPushPayloadMetadata(
  payload: Record<string, unknown> | null | undefined
): PushPayloadMetadata {
  const metadata = payload?.[PUSH_METADATA_KEY];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const value = metadata as Record<string, unknown>;
  return {
    titleLocArgs: stringArguments(value.titleLocArgs),
    bodyLocArgs: stringArguments(value.bodyLocArgs),
    reaction: value.reaction,
  };
}

export function withPushPayloadMetadata(
  payload: Record<string, unknown>,
  metadata: PushPayloadMetadata
): Record<string, unknown> {
  const publicPayload = { ...payload };
  delete publicPayload[PUSH_METADATA_KEY];
  return { ...publicPayload, [PUSH_METADATA_KEY]: metadata };
}

export function prepareApnsPayload(payload: Record<string, unknown>): {
  payload: Record<string, unknown>;
  titleLocArgs?: string[];
  bodyLocArgs?: string[];
} {
  const metadata = readPushPayloadMetadata(payload);
  const publicPayload = { ...payload };
  delete publicPayload[PUSH_METADATA_KEY];
  return {
    payload: publicPayload,
    titleLocArgs: metadata.titleLocArgs,
    bodyLocArgs: metadata.bodyLocArgs,
  };
}
