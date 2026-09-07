import {
  API_BASE,
  MCP_RESOURCE,
  REDIRECT_URI,
  assert,
  assertStatus,
  publicRequest,
  randomToken,
  request,
  sha256Base64Url,
} from './common.test';
import { extractRequestId, startAuthorization } from './flow.test';

export async function testMetadata() {
  const protectedResource = await publicRequest('/.well-known/oauth-protected-resource');
  assertStatus(protectedResource.status, 200, 'protected resource metadata');
  assert(protectedResource.data.resource === MCP_RESOURCE, 'protected resource mismatch');
  const authServer = await publicRequest('/.well-known/oauth-authorization-server');
  assertStatus(authServer.status, 200, 'authorization server metadata');
  assert(
    authServer.data.authorization_endpoint?.endsWith('/v2/api/oauth/authorize'),
    'missing auth endpoint'
  );
  assert(authServer.data.token_endpoint?.endsWith('/v2/api/oauth/token'), 'missing token endpoint');
  assert(
    authServer.data.client_id_metadata_document_supported === true,
    'missing client_id metadata support marker'
  );
  assert(
    protectedResource.data.scopes_supported?.includes('notes:share'),
    'protected resource metadata missing notes:share'
  );
  assert(
    authServer.data.scopes_supported?.includes('notes:share'),
    'authorization server metadata missing notes:share'
  );
}

export async function testAuthorizeValidation(clientId: string, codeChallenge: string) {
  const badResponseTypeParams = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'notes:read',
    resource: MCP_RESOURCE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  const badResponseType = await request('GET', '/oauth/authorize?' + badResponseTypeParams, {
    redirect: 'manual',
  });
  assertStatus(badResponseType.status, 400, 'unsupported response_type');
  assert(
    badResponseType.data.error === 'unsupported_response_type',
    'unsupported response_type should return OAuth error'
  );

  const badRedirect = await startAuthorization({
    clientId,
    scopes: ['notes:read'],
    codeChallenge,
    redirectUri: 'http://localhost:9999/wrong',
  });
  assertStatus(badRedirect.status, 400, 'bad redirect_uri should be rejected');
  assert(badRedirect.data.error === 'invalid_request', 'bad redirect should return OAuth error');

  const badScope = await startAuthorization({
    clientId,
    scopes: ['notes:read', 'unknown:scope'],
    codeChallenge,
  });
  assertStatus(badScope.status, 400, 'bad scope should be rejected');
  assert(badScope.data.error === 'invalid_scope', 'bad scope should return OAuth error');

  const badResource = await startAuthorization({
    clientId,
    scopes: ['notes:read'],
    codeChallenge,
    resource: API_BASE + '/not-mcp',
  });
  assertStatus(badResource.status, 400, 'bad resource should be rejected');
  assert(badResource.data.error === 'invalid_target', 'bad resource should return OAuth error');
}

export async function testDenyFlow(
  appAccessToken: string,
  clientId: string,
  codeChallenge: string
) {
  const authorize = await startAuthorization({
    clientId,
    scopes: ['notes:read'],
    codeChallenge,
    state: 'deny-state',
  });
  assertStatus(authorize.status, 302, 'deny flow authorization redirect');
  const requestId = extractRequestId(authorize.headers.get('location') || '');
  const deny = await request('POST', '/oauth/authorize/approve', {
    headers: { Authorization: 'Bearer ' + appAccessToken },
    body: { requestId, decision: 'deny' },
  });
  assertStatus(deny.status, 200, 'authorization denial');
  const redirectUrl = new URL(deny.data.data.redirectUrl);
  assert(redirectUrl.searchParams.get('error') === 'access_denied', 'deny redirect error mismatch');
  assert(redirectUrl.searchParams.get('state') === 'deny-state', 'deny redirect state mismatch');
}

export async function testClientInitiatedNativeClientFlow(appAccessToken: string) {
  const clientId = 'org.rcex.KeepTalkingTest';
  const redirectUri = 'ktoauthtest://oauth/callback';
  const verifier = randomToken(48);
  const codeChallenge = await sha256Base64Url(verifier);
  const state = randomToken(12);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'notes:read notes:write profile:read',
    resource: MCP_RESOURCE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  const authorize = await request('GET', '/oauth/authorize?' + params, { redirect: 'manual' });
  assertStatus(authorize.status, 302, 'client-initiated native authorization redirect');
  const requestId = extractRequestId(authorize.headers.get('location') || '');

  const session = await request('GET', '/oauth/authorize/session?requestId=' + requestId, {
    headers: { Authorization: 'Bearer ' + appAccessToken },
  });
  assertStatus(session.status, 200, 'client-initiated native authorization session');
  assert(session.data.data?.client?.clientId === clientId, 'native client id mismatch');
  assert(session.data.data?.redirectUri === redirectUri, 'native redirect_uri mismatch');

  const approve = await request('POST', '/oauth/authorize/approve', {
    headers: { Authorization: 'Bearer ' + appAccessToken },
    body: { requestId, decision: 'approve' },
  });
  assertStatus(approve.status, 200, 'client-initiated native authorization approval');
  const redirect = new URL(approve.data.data.redirectUrl);
  assert(redirect.protocol === 'ktoauthtest:', 'native redirect scheme mismatch');
  assert(redirect.searchParams.get('state') === state, 'native redirect state mismatch');
  const code = redirect.searchParams.get('code');
  assert(code, 'native authorization code missing');

  const token = await request('POST', '/oauth/token', {
    form: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
      resource: MCP_RESOURCE,
    }),
  });
  assertStatus(token.status, 200, 'client-initiated native token exchange');
  assert(token.data.access_token, 'native access token missing');
  assert(token.data.refresh_token, 'native refresh token missing');

  const revoke = await request('POST', '/oauth/revoke', {
    form: new URLSearchParams({ token: token.data.refresh_token }),
  });
  assertStatus(revoke.status, 200, 'native refresh token revoke');
}
