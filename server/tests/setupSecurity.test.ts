import { describe, expect, it } from 'bun:test';
import { buildSetupGeneratedKeysResponse } from '../utils/setupSecurity';

describe('setup security', () => {
  it('does not expose generated private setup secrets', () => {
    const keys = buildSetupGeneratedKeysResponse(
      {
        jwtSecret: 'jwt-secret',
        jwtRefreshSecret: 'refresh-secret',
        jwtAccessExpiry: '7d',
        jwtRefreshExpiry: '30d',
        sessionSecret: 'session-secret',
      },
      {
        vapidPublicKey: 'public-key',
        vapidPrivateKey: 'private-key',
      }
    );

    expect(keys).toEqual({
      jwtSecret: '***generated***',
      jwtRefreshSecret: '***generated***',
      sessionSecret: '***generated***',
      vapidPublicKey: 'public-key',
      vapidPrivateKey: '***generated***',
    });
  });
});
