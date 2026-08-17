import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';
import { errorHandler } from '../utils/handlers';
import { PUSH_API_ERROR_CODES, PushApiError } from './errors';

describe('push API error contract', () => {
  it('publishes only stable machine-readable push error codes', () => {
    expect(PUSH_API_ERROR_CODES).toEqual([
      'push_not_available',
      'push_invalid_request',
      'push_invalid_time_zone',
      'push_device_not_found',
      'push_device_registration_required',
      'push_campaign_not_found',
      'push_campaign_already_sent',
    ]);
    for (const code of PUSH_API_ERROR_CODES) {
      expect(new PushApiError(code, 400).message).toBe(code);
    }
  });

  it('serializes every push error code through the HTTP error contract', async () => {
    const cases = [
      ['push_not_available', 404],
      ['push_invalid_request', 400],
      ['push_invalid_time_zone', 400],
      ['push_device_not_found', 404],
      ['push_device_registration_required', 409],
      ['push_campaign_not_found', 404],
      ['push_campaign_already_sent', 409],
    ] as const;

    for (const [code, status] of cases) {
      const app = new Hono<{ Variables: HonoVariables }>();
      app.get('/', () => {
        throw new PushApiError(code, status);
      });
      app.onError(errorHandler);

      const response = await app.request('/');
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code: 1, message: code, data: null });
    }
  });
});
