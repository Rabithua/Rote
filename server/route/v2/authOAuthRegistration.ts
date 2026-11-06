import { Hono } from 'hono';
import {
  finishOAuthRegistration,
  getOAuthRegistrationOptions,
} from '../../oauthAccounts/registration';
import { OAuthRegistrationError } from '../../oauthAccounts/registrationError';
import type { HonoVariables } from '../../types/hono';
import { createResponse, sanitizeUserData } from '../../utils/main';

const oauthRegistrationRouter = new Hono<{ Variables: HonoVariables }>();

oauthRegistrationRouter.onError((error, c) => {
  if (!(error instanceof OAuthRegistrationError)) throw error;
  return c.json(
    { ...createResponse(null, error.message, error.status), errorCode: error.code },
    error.status
  );
});

oauthRegistrationRouter.get('/:registrationToken', async (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(
    createResponse(await getOAuthRegistrationOptions(c.req.param('registrationToken'))),
    200
  );
});

oauthRegistrationRouter.post('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new OAuthRegistrationError('oauth_registration_invalid');
  }
  if (!body || typeof body !== 'object' || !('registrationToken' in body)) {
    throw new OAuthRegistrationError('oauth_registration_invalid');
  }
  if (typeof body.registrationToken !== 'string') {
    throw new OAuthRegistrationError('oauth_registration_invalid');
  }
  const result = await finishOAuthRegistration(
    body.registrationToken,
    'username' in body ? body.username : undefined
  );
  return c.json(createResponse({ ...result, user: sanitizeUserData(result.user) }), 201);
});

export default oauthRegistrationRouter;
