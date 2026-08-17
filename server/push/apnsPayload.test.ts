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
});
