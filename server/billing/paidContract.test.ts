import { describe, expect, it } from 'bun:test';
import fixture from './fixtures/rote-to-paid-v1.json';
import {
  PaidContractError,
  parsePaidActivationResponse,
  parsePaidErrorResponse,
  parsePaidSessionResponse,
  serializePaidActivationRequest,
  serializePaidSessionRequest,
} from './paidContract';
import { signBillingRequest } from './signature';

describe('centralized Rote-to-Paid contract', () => {
  it('matches exact session and activation bytes, canonical requests, and signatures', () => {
    for (const hmacCase of [fixture.hmacCase, fixture.activationHmacCase]) {
      const signed = signBillingRequest({
        key: {
          keyId: fixture.fixtureKey.keyId,
          secret: Buffer.from(fixture.fixtureKey.secretHex, 'hex'),
        },
        method: hmacCase.method,
        pathAndQuery: hmacCase.pathAndQuery,
        timestamp: hmacCase.timestamp,
        requestId: hmacCase.requestId,
        body: hmacCase.body,
      });
      expect(Buffer.byteLength(hmacCase.body)).toBe(hmacCase.expected.bodyByteLength);
      expect(signed.bodyHash).toBe(hmacCase.expected.bodySha256);
      expect(signed.canonicalRequest).toBe(hmacCase.expected.canonicalRequest);
      expect(Buffer.from(signed.canonicalRequest).toString('base64')).toBe(
        hmacCase.expected.canonicalRequestBase64
      );
      expect(signed.signature).toBe(hmacCase.expected.signature);
    }
  });

  it('serializes the exact Paid-owned canonical session request bytes', () => {
    expect(
      serializePaidSessionRequest({
        requestId: fixture.hmacCase.requestId,
        instanceId: 'rote-official',
        userId: '11111111-2222-4333-8444-555555555555',
      })
    ).toBe(fixture.hmacCase.body);
  });

  it('keeps activation field order and response envelope centralized', () => {
    expect(serializePaidActivationRequest(fixture.activationRequest)).toBe(
      fixture.activationHmacCase.body
    );
    expect(parsePaidSessionResponse(fixture.sessionSuccessResponse)).toEqual(
      fixture.sessionSuccessResponse.data
    );

    for (const response of [
      fixture.activationSuccessResponse,
      fixture.duplicateActivationResponse,
    ]) {
      const parsed = parsePaidActivationResponse({
        value: response,
        instanceId: 'rote-official',
        productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
        receivedAt: new Date('2026-08-07T00:00:00.000Z'),
      });
      expect(parsed.revision).toBe(BigInt(42));
      expect(parsed.planId).toBe('rote_pro');
      expect(parsed.capabilities).toEqual(['ai.chat', 'attachment.video.upload']);
    }
  });

  it('requires exact status/code/message error combinations', () => {
    for (const errorCase of Object.values(fixture.standardErrorResponses)) {
      expect(
        parsePaidErrorResponse({ status: errorCase.httpStatus, value: errorCase.body })
      ).toEqual({ status: errorCase.httpStatus, message: errorCase.body.message });
    }
    expect(() => parsePaidErrorResponse({ status: 503, value: fixture.errorResponse })).toThrow(
      PaidContractError
    );
  });

  it('requires positive revision, rote_pro, and canonical granting capabilities', () => {
    const snapshot = fixture.activationSuccessResponse.data;
    for (const invalidSnapshot of [
      { ...snapshot, revision: '0' },
      { ...snapshot, planId: null },
      { ...snapshot, capabilities: ['ai.chat'] },
      { ...snapshot, capabilities: ['attachment.video.upload', 'ai.chat'] },
    ]) {
      expect(() =>
        parsePaidActivationResponse({
          value: { code: 0, message: 'success', data: invalidSnapshot },
          instanceId: 'rote-official',
          productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
          receivedAt: new Date('2026-08-07T00:00:00.000Z'),
        })
      ).toThrow(PaidContractError);
    }
  });
});
