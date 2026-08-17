import { describe, expect, it } from 'bun:test';
import { APNS_MAX_PAYLOAD_BYTES, isApnsPayloadWithinLimit, serializeApnsPayload } from './apns';

describe('APNs payload sizing', () => {
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
