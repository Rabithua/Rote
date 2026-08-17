import { describe, expect, it } from 'bun:test';
import { prepareApnsPayload, readPushPayloadMetadata, withPushPayloadMetadata } from './payload';

describe('push payload metadata', () => {
  it('keeps presentation metadata in the queue but removes it from the device payload', () => {
    const queued = withPushPayloadMetadata(
      { roteId: 'rote-a' },
      {
        titleLocArgs: ['Alice'],
        bodyLocArgs: ['❤️', 'Summer wind'],
        reaction: { actorKeys: ['user:alice'] },
      }
    );
    expect(readPushPayloadMetadata(queued)).toEqual({
      titleLocArgs: ['Alice'],
      bodyLocArgs: ['❤️', 'Summer wind'],
      reaction: { actorKeys: ['user:alice'] },
    });
    expect(prepareApnsPayload(queued)).toEqual({
      payload: { roteId: 'rote-a' },
      titleLocArgs: ['Alice'],
      bodyLocArgs: ['❤️', 'Summer wind'],
    });
  });
});
