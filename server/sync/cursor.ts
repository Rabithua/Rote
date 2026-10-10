import { HTTPException } from 'hono/http-exception';

export interface SyncCursor {
  version: 1;
  userId: string;
  revision: string;
  through?: string;
}

const maximumRevision = BigInt('9223372036854775807');

function isRevision(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9]\d{0,18})$/.test(value) &&
    BigInt(value) <= maximumRevision
  );
}

export function encodeSyncCursor(userId: string, revision: bigint, through?: bigint): string {
  const cursor: SyncCursor = {
    version: 1,
    userId,
    revision: revision.toString(),
    ...(through !== undefined ? { through: through.toString() } : {}),
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeSyncCursor(value: string | undefined, userId: string): SyncCursor {
  let cursor: SyncCursor;
  try {
    if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    cursor = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (
      cursor?.version !== 1 ||
      cursor.userId !== userId ||
      !isRevision(cursor.revision) ||
      (cursor.through !== undefined &&
        (!isRevision(cursor.through) || BigInt(cursor.through) < BigInt(cursor.revision)))
    )
      throw new Error();
  } catch {
    throw new HTTPException(400, { message: 'invalid_sync_cursor' });
  }
  return cursor;
}
