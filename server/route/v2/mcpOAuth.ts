import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import mainJson from '../../json/main.json';
import { resolveClientInitiatedOAuthClient } from '../../oauth/clientMetadata';
import messages from '../../oauth/messages.json';
import {
  consumeOAuthAuthorizationCode,
  createOAuthAuthorizationCode,
  createOAuthAuthorizationRequest,
  createOAuthClient,
  findOAuthClient,
  findOAuthRefreshToken,
  revokeOAuthRefreshToken,
  rotateOAuthRefreshToken,
  updateOAuthAuthorizationRequestStatus,
  upsertOAuthGrant,
} from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { generateMcpAccessToken } from '../../oauth/tokens';
import { formatScope } from '../../oauth/scopes';
import {
  getFrontendAuthorizeUrl,
  getPendingRequestWithClient,
  issueTokenPair,
  normalizeClientScopes,
  normalizeRequestedScopes,
} from '../../oauth/flow';
import { oauthError, withOAuthErrors } from '../../oauth/errors';
import {
  appendOAuthRedirectParams,
  assertValidRedirectUri,
  expiresIn,
  getMcpResource,
  getOAuthIssuer,
  isRegisteredRedirectUri,
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_AUTHORIZATION_CODE_TTL_SECONDS,
  OAUTH_AUTHORIZATION_REQUEST_TTL_SECONDS,
  OAUTH_REFRESH_TOKEN_TTL_SECONDS,
  parseFormBody,
  pkceS256,
  randomOAuthToken,
  sha256Hex,
} from '../../oauth/utils';
import type { HonoContext, HonoVariables, SafeUser } from '../../types/hono';

const oauthRouter = new Hono<{ Variables: HonoVariables }>();

oauthRouter.post('/register', (c: HonoContext) =>
  withOAuthErrors(c, async () => {
    const body = await c.req.json().catch(() => ({}));
    const redirectUris = (body as any).redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      oauthError(messages.errors.invalidClientMetadata, messages.redirectUrisRequired);
    }

    const normalizedRedirectUris = redirectUris.map((uri) => {
      if (typeof uri !== 'string') {
        oauthError(messages.errors.invalidClientMetadata, messages.redirectUrisMustContainStrings);
      }
      assertValidRedirectUri(uri);
      return uri;
    });

    const clientName =
      typeof (body as any).client_name === 'string' && (body as any).client_name.trim().length > 0
        ? (body as any).client_name.trim()
        : messages.defaultClientName;
    const scopes = normalizeClientScopes((body as any).scope);
    const client = await createOAuthClient({
      clientId: 'rote_mcp_' + randomUUID(),
      clientName,
      redirectUris: normalizedRedirectUris,
      scopes,
      clientUri: typeof (body as any).client_uri === 'string' ? (body as any).client_uri : null,
      logoUri: typeof (body as any).logo_uri === 'string' ? (body as any).logo_uri : null,
    });

    return c.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.clientName,
        client_uri: client.clientUri,
        logo_uri: client.logoUri,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method: 'none',
        scope: formatScope(client.scopes),
      },
      201
    );
  })
);

oauthRouter.get('/authorize', (c: HonoContext) =>
  withOAuthErrors(c, async () => {
    const responseType = c.req.query('response_type');
    const clientId = c.req.query('client_id');
    const redirectUri = c.req.query('redirect_uri');
    const resource = c.req.query('resource');
    const codeChallenge = c.req.query('code_challenge');
    const codeChallengeMethod = c.req.query('code_challenge_method');
    if (responseType !== 'code')
      oauthError(messages.errors.unsupportedResponseType, messages.onlyCodeResponseType);
    if (!clientId || !redirectUri || !resource || !codeChallenge || !codeChallengeMethod)
      oauthError(messages.errors.invalidRequest, messages.missingAuthorizationParameter);
    if (codeChallengeMethod !== 'S256')
      oauthError(messages.errors.invalidRequest, messages.onlyPkceS256);

    const client = await resolveClientInitiatedOAuthClient(clientId, { redirectUri });
    if (!client) oauthError(messages.errors.invalidClient, messages.clientNotFound);
    if (!isRegisteredRedirectUri(client.redirectUris, redirectUri))
      oauthError(messages.errors.invalidRequest, messages.redirectUriMismatch);
    if (resource !== getMcpResource(c))
      oauthError(messages.errors.invalidTarget, messages.invalidResource);

    const request = await createOAuthAuthorizationRequest({
      clientId,
      redirectUri,
      scopes: normalizeRequestedScopes(c.req.query('scope'), client.scopes),
      state: c.req.query('state') || null,
      resource,
      codeChallenge,
      codeChallengeMethod,
      expiresAt: expiresIn(OAUTH_AUTHORIZATION_REQUEST_TTL_SECONDS),
    });
    return c.redirect(getFrontendAuthorizeUrl(c, request.id), 302);
  })
);

oauthRouter.get('/authorize/session', authenticateJWT, async (c: HonoContext) => {
  const requestId = c.req.query('requestId');
  if (!requestId) throw new Error(messages.codes.requestIdRequired);
  const { request, client } = await getPendingRequestWithClient(requestId);
  return c.json(
    createResponse({
      requestId: request.id,
      client: {
        clientId: client.clientId,
        clientName: client.clientName,
        clientUri: client.clientUri,
        logoUri: client.logoUri,
      },
      scopes: request.scopes,
      resource: request.resource,
      redirectUri: request.redirectUri,
      expiresAt: request.expiresAt,
      safeRoutes: mainJson.safeRoutes,
    })
  );
});

oauthRouter.post('/authorize/approve', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as SafeUser;
  const body = await c.req.json().catch(() => ({}));
  const requestId = (body as any).requestId;
  const decision = (body as any).decision;
  if (!requestId || (decision !== 'approve' && decision !== 'deny'))
    throw new Error(messages.codes.decisionRequired);

  const { request } = await getPendingRequestWithClient(requestId);
  if (decision === 'deny') {
    await updateOAuthAuthorizationRequestStatus(request.id, 'denied', user.id);
    return c.json(
      createResponse({
        redirectUrl: appendOAuthRedirectParams(request.redirectUri, {
          error: messages.errors.accessDenied,
          state: request.state || undefined,
        }),
      })
    );
  }

  await updateOAuthAuthorizationRequestStatus(request.id, 'approved', user.id);
  await upsertOAuthGrant({
    userId: user.id,
    clientId: request.clientId,
    scopes: request.scopes,
    resource: request.resource,
  });
  const code = randomOAuthToken(32);
  await createOAuthAuthorizationCode({
    codeHash: sha256Hex(code),
    requestId: request.id,
    clientId: request.clientId,
    userId: user.id,
    redirectUri: request.redirectUri,
    scopes: request.scopes,
    resource: request.resource,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: request.codeChallengeMethod,
    expiresAt: expiresIn(OAUTH_AUTHORIZATION_CODE_TTL_SECONDS),
  });
  return c.json(
    createResponse({
      redirectUrl: appendOAuthRedirectParams(request.redirectUri, {
        code,
        state: request.state || undefined,
      }),
    })
  );
});

oauthRouter.post('/token', (c: HonoContext) =>
  withOAuthErrors(c, async () => {
    const body = await parseFormBody(c);
    const clientId = body.client_id;
    if (!clientId) oauthError(messages.errors.invalidRequest, messages.clientIdRequired);
    const client = await findOAuthClient(clientId);
    if (!client) oauthError(messages.errors.invalidClient, messages.clientNotFound);

    if (body.grant_type === 'authorization_code') {
      const tokenResponse = await exchangeAuthorizationCode(c, body, clientId);
      if ('error' in tokenResponse) return c.json(tokenResponse, 400);
      return c.json(tokenResponse, 200);
    }
    if (body.grant_type === 'refresh_token') {
      const tokenResponse = await exchangeRefreshToken(c, body, clientId);
      if ('error' in tokenResponse) return c.json(tokenResponse, 400);
      return c.json(tokenResponse, 200);
    }
    return c.json({ error: messages.errors.unsupportedGrantType }, 400);
  })
);

async function exchangeAuthorizationCode(
  c: HonoContext,
  body: Record<string, string>,
  clientId: string
) {
  const { code, redirect_uri: redirectUri, code_verifier: codeVerifier, resource } = body;
  if (!code || !redirectUri || !codeVerifier || !resource)
    oauthError(messages.errors.invalidRequest, messages.missingCodeExchangeParameter);
  const record = await consumeOAuthAuthorizationCode(sha256Hex(code));
  if (!record) return { error: messages.errors.invalidGrant };
  const valid =
    record.clientId === clientId &&
    record.redirectUri === redirectUri &&
    record.resource === resource &&
    resource === getMcpResource(c) &&
    record.codeChallengeMethod === 'S256' &&
    pkceS256(codeVerifier) === record.codeChallenge;
  if (!valid) return { error: messages.errors.invalidGrant };
  const tokenResponse = await issueTokenPair({
    c,
    userId: record.userid,
    clientId,
    scopes: record.scopes,
    resource: record.resource,
  });
  const { refresh_token_id: _refreshTokenId, ...publicResponse } = tokenResponse;
  return publicResponse;
}

async function exchangeRefreshToken(
  c: HonoContext,
  body: Record<string, string>,
  clientId: string
) {
  const refreshToken = body.refresh_token;
  const resource = body.resource || getMcpResource(c);
  if (!refreshToken) oauthError(messages.errors.invalidRequest, messages.refreshTokenRequired);
  const newRefreshToken = randomOAuthToken(48);
  const rotation = await rotateOAuthRefreshToken({
    tokenHash: sha256Hex(refreshToken),
    clientId,
    resource,
    newTokenHash: sha256Hex(newRefreshToken),
    expiresAt: expiresIn(OAUTH_REFRESH_TOKEN_TTL_SECONDS),
  });
  if (!rotation) return { error: messages.errors.invalidGrant };
  const accessToken = await generateMcpAccessToken({
    issuer: getOAuthIssuer(c),
    resource: rotation.newToken.resource,
    userId: rotation.newToken.userid,
    clientId,
    scopes: rotation.newToken.scopes,
  });
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: newRefreshToken,
    scope: formatScope(rotation.newToken.scopes),
    resource: rotation.newToken.resource,
  };
}
oauthRouter.post('/revoke', (c: HonoContext) =>
  withOAuthErrors(c, async () => {
    const body = await parseFormBody(c);
    if (!body.token) oauthError(messages.errors.invalidRequest, messages.tokenRequired);
    const token = await findOAuthRefreshToken(sha256Hex(body.token));
    if (token && !token.revokedAt) await revokeOAuthRefreshToken(token.id);
    return c.json(createResponse(null, messages.revoked), 200);
  })
);

export default oauthRouter;
