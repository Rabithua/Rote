import { describe, expect, it } from 'bun:test';
import { prepareApnsPayload, readPushPayloadMetadata, withPushPayloadMetadata } from './payload';
import { serializeApnsPayload } from './apns';

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

  it('delivers the queued sender snapshot with the original wording and route', () => {
    const sender = {
      id: 'sender-a',
      displayName: 'Name when the reaction happened',
      avatarURL: 'https://example.test/queued-avatar.png',
    };
    const queued = withPushPayloadMetadata(
      { roteId: 'rote-a', eventType: 'reaction.received', recipientId: 'recipient-a', sender },
      {
        titleLocArgs: [sender.displayName],
        bodyLocArgs: ['❤️', 'A content preview'],
        reaction: { actorKeyHashes: ['private-hash'] },
      }
    );
    const prepared = prepareApnsPayload(queued);
    const serialized = JSON.parse(
      serializeApnsPayload({
        ...prepared,
        titleLocKey: 'push.reaction.detail.known.title',
        bodyLocKey: 'push.reaction.detail.body',
        route: 'rote://detail?id=rote-a',
      })
    );

    expect(serialized.sender).toEqual(sender);
    expect(serialized.recipientId).toBe('recipient-a');
    expect(serialized.aps.alert['title-loc-args']).toEqual([sender.displayName]);
    expect(serialized.aps.alert['loc-args']).toEqual(['❤️', 'A content preview']);
    expect(serialized.route).toBe('rote://detail?id=rote-a');
    expect(serialized.aps['mutable-content']).toBe(1);
    expect(serialized._push).toBeUndefined();
    expect(queued.sender).toEqual(sender);
  });
});
