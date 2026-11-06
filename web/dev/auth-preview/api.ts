import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { previewTokens, profileFromToken, readScenario, siteStatus } from './fixtures';

type Registration = { username: string; provider?: string; returnUrl: string; expired: boolean };

export function authPreviewApi() {
  const registrations = new Map<string, Registration>();
  const authenticationChallenges = new Set<string>();
  const reply = (res: ServerResponse, data: unknown, status = 200, message = '') => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify({
        code: status >= 400 ? status : 0,
        message,
        data,
        ...(status >= 400 ? { errorCode: message } : {}),
      })
    );
  };

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL) {
    const path = url.pathname.replace('/v2/api', '');
    const scenario = readScenario(req.headers.cookie);
    const config = siteStatus(scenario);
    const origin = url.origin;
    let body: Record<string, any> = {};
    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return reply(res, null, 400, 'registration_invalid');
      }
    }
    if (path === '/site/status') return reply(res, config);
    if (path === '/site/config-status') return reply(res, { isInitialized: true });
    if (path === '/users/me/profile') {
      const profile = profileFromToken(req.headers.authorization);
      return reply(res, profile, profile ? 200 : 401);
    }
    if (path === '/users/me/settings') return reply(res, { allowExplore: true });
    if (path === '/auth/passkey/config') return reply(res, { enabled: config.passkey.enabled });
    if (path === '/auth/passkey') return reply(res, []);

    const oauth = path.match(/^\/auth\/oauth\/(github|apple)$/);
    if (oauth) {
      const returnUrl =
        url.searchParams.get('redirect') || '/login?redirect=%2F__auth-preview%2Fsuccess';
      const callback = new URL(returnUrl, origin);
      if (scenario === 'closed') {
        callback.searchParams.set('oauth', 'error');
        callback.searchParams.set('message', 'registration_disabled');
        callback.searchParams.set('errorCode', 'registration_disabled');
      } else if (scenario === 'existing') {
        const tokens = previewTokens('returning_user');
        callback.searchParams.set('oauth', 'success');
        callback.searchParams.set('token', tokens.accessToken);
        callback.searchParams.set('refreshToken', tokens.refreshToken);
      } else {
        const registrationToken = randomUUID();
        registrations.set(registrationToken, {
          provider: oauth[1],
          username: `${oauth[1]}_user`,
          returnUrl,
          expired: scenario === 'expired',
        });
        callback.searchParams.set('oauth', 'register');
        callback.searchParams.set('registrationToken', registrationToken);
      }
      callback.searchParams.set('provider', oauth[1]);
      res.writeHead(302, { Location: callback.toString(), 'Cache-Control': 'no-store' });
      return res.end();
    }

    if (path.startsWith('/auth/register/oauth/')) {
      const pending = registrations.get(path.split('/').pop() || '');
      if (!pending || pending.expired) return reply(res, null, 410, 'oauth_registration_expired');
      return reply(res, { provider: pending.provider, suggestedUsername: pending.username });
    }

    if (path.startsWith('/auth/register')) {
      if (!config.ui.allowRegistration) return reply(res, null, 403, 'registration_disabled');
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(String(body.username || '')) && !path.endsWith('/verify')) {
        return reply(res, null, 400, 'username_invalid');
      }
      if (body.username === 'taken') return reply(res, null, 409, 'username_unavailable');
    }

    if (path === '/auth/register/passkey/options') {
      const registrationToken = randomUUID();
      registrations.set(registrationToken, {
        username: body.username,
        returnUrl: '',
        expired: false,
      });
      return reply(res, {
        registrationToken,
        options: {
          challenge: 'cHJldmlldy1jaGFsbGVuZ2U',
          rp: { name: 'Rote', id: url.hostname },
          user: { id: 'cHJldmlldy11c2Vy', name: body.username, displayName: body.username },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        },
      });
    }
    if (path === '/auth/register/passkey/verify') {
      const pending = registrations.get(body.registrationToken);
      if (!pending) return reply(res, null, 410, 'registration_expired');
      registrations.delete(body.registrationToken);
      return reply(res, previewTokens(pending.username));
    }
    if (path === '/auth/register/oauth' && req.method === 'POST') {
      const pending = registrations.get(body.registrationToken);
      if (!pending || pending.expired) return reply(res, null, 410, 'oauth_registration_expired');
      registrations.delete(body.registrationToken);
      const tokens = previewTokens(body.username);
      const completion = new URL(pending.returnUrl, origin);
      completion.searchParams.set('oauth', 'success');
      completion.searchParams.set('token', tokens.accessToken);
      completion.searchParams.set('refreshToken', tokens.refreshToken);
      return reply(res, { ...tokens, completionUrl: completion.toString() });
    }
    if (path === '/auth/register') {
      if (!body.email || !body.password) return reply(res, null, 400, 'registration_invalid');
      return reply(res, previewTokens(body.username, body.email));
    }
    if (path === '/auth/login')
      return reply(res, previewTokens(body.username || 'returning_user', 'preview@example.test'));
    if (path === '/auth/passkey/authenticate/options') {
      const challengeKey = randomUUID();
      authenticationChallenges.add(challengeKey);
      return reply(res, {
        challengeKey,
        options: {
          challenge: 'cHJldmlldy1jaGFsbGVuZ2U',
          rpId: url.hostname,
          userVerification: 'required',
          allowCredentials: [],
        },
      });
    }
    if (path === '/auth/passkey/authenticate/verify') {
      if (!authenticationChallenges.delete(body.challengeKey))
        return reply(res, null, 400, 'registration_invalid');
      return reply(res, previewTokens('passkey_user'));
    }
    return reply(res, null, 404, 'preview_endpoint_not_found');
  };
}
