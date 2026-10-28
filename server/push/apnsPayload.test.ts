import { describe, expect, it } from 'bun:test';
import { APNS_MAX_PAYLOAD_BYTES, isApnsPayloadWithinLimit, serializeApnsPayload } from './apns';
import { reactionNotificationSender } from './reactionPresentation';

describe('APNs payload sizing', () => {
  const sender = {
    id: 'alice',
    displayName: 'Alice',
    avatarURL: 'https://example.test/alice.png',
  };

  it('invokes notification enrichment only for a user reaction with a usable avatar', () => {
    const payload = {
      eventType: 'reaction.received',
      recipientId: 'recipient',
      sender,
    };
    expect(
      JSON.parse(serializeApnsPayload({ title: 'Alice', body: '❤️', payload })).aps[
        'mutable-content'
      ]
    ).toBe(1);
    for (const fallback of [
      {},
      { ...payload, eventType: 'system.test' },
      { ...payload, sender: undefined },
      { ...payload, sender: { id: 'alice', displayName: 'Alice' } },
      { ...payload, sender: { ...sender, avatarURL: 'http://example.test/avatar.png' } },
      { ...payload, sender: { ...sender, avatarURL: 'https://' } },
      { ...payload, sender: { ...sender, avatarURL: 'https://user:password@example.test/a.png' } },
      { ...payload, recipientId: '  ' },
    ]) {
      expect(
        JSON.parse(serializeApnsPayload({ title: 'Rote', body: '❤️', payload: fallback })).aps[
          'mutable-content'
        ]
      ).toBeUndefined();
    }
  });

  it('measures the serialized UTF-8 payload and rejects payloads over 4 KB', () => {
    const regular = {
      title: 'System update',
      body: 'A short campaign message',
      route: 'rote://home',
      payload: { campaignId: '00000000-0000-0000-0000-000000000000' },
    };
    expect(isApnsPayloadWithinLimit(regular)).toBe(true);

    const oversized = { ...regular, route: `rote://${'界'.repeat(2_000)}` };
    expect(Buffer.byteLength(serializeApnsPayload(oversized), 'utf8')).toBeGreaterThan(
      APNS_MAX_PAYLOAD_BYTES
    );
    expect(isApnsPayloadWithinLimit(oversized)).toBe(false);
  });

  it('fits the largest supported avatar URL and bounded sender name within the APNs limit', () => {
    const sender = reactionNotificationSender(
      '00000000-0000-0000-0000-000000000001',
      '👩‍💻'.repeat(100),
      `https://example.test/${'a'.repeat(1_000)}`
    );
    expect(sender?.avatarURL).toBeDefined();
    expect(
      isApnsPayloadWithinLimit({
        titleLocKey: 'push.reaction.detail.known.title',
        bodyLocKey: 'push.reaction.detail.body',
        titleLocArgs: [sender!.displayName],
        bodyLocArgs: ['❤️', 'A content preview'],
        route: 'rote://detail?id=rote-a',
        payload: {
          roteId: 'rote-a',
          eventType: 'reaction.received',
          recipientId: '00000000-0000-0000-0000-000000000002',
          sender,
        },
      })
    ).toBe(true);
  });

  it('serializes localized title and body arguments into the alert', () => {
    const payload = JSON.parse(
      serializeApnsPayload({
        titleLocKey: 'push.reaction.detail.known.title',
        bodyLocKey: 'push.reaction.detail.body',
        titleLocArgs: ['Alice'],
        bodyLocArgs: ['❤️', 'Summer wind'],
        route: 'rote://detail?id=rote-a',
        payload: { roteId: 'rote-a' },
      })
    );
    expect(payload.aps.alert).toEqual({
      'title-loc-key': 'push.reaction.detail.known.title',
      'loc-key': 'push.reaction.detail.body',
      'title-loc-args': ['Alice'],
      'loc-args': ['❤️', 'Summer wind'],
    });
  });
});
