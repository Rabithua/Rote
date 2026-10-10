import { describe, expect, it } from 'bun:test';
import { decodeSyncCursor, encodeSyncCursor } from './cursor';

describe('sync cursors', () => {
  it('round-trips revisions beyond JavaScript integer precision', () => {
    const token = encodeSyncCursor('owner', 9007199254740993n, 9007199254740999n);
    expect(decodeSyncCursor(token, 'owner')).toEqual({
      version: 1,
      userId: 'owner',
      revision: '9007199254740993',
      through: '9007199254740999',
    });
  });

  it('rejects a cursor from another account', () => {
    expect(() => decodeSyncCursor(encodeSyncCursor('owner', 0n), 'other')).toThrow(
      'invalid_sync_cursor'
    );
  });

  it.each([undefined, '', '!', 'a'.repeat(513)])('rejects malformed cursors: %s', (token) => {
    expect(() => decodeSyncCursor(token, 'owner')).toThrow('invalid_sync_cursor');
  });

  it.each([
    { version: 2, revision: '0' },
    { version: 1, revision: 1 },
    { version: 1, revision: '-1' },
    { version: 1, revision: '9223372036854775808' },
    { version: 1, revision: '2', through: '1' },
  ])('rejects invalid cursor fields: %j', (fields) => {
    const token = Buffer.from(JSON.stringify({ userId: 'owner', ...fields })).toString('base64url');
    expect(() => decodeSyncCursor(token, 'owner')).toThrow('invalid_sync_cursor');
  });
});
