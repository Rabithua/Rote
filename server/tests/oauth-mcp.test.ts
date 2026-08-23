import {
  ALL_SCOPES,
  API_BASE,
  ensureInitialized,
  loginOrRegister,
  randomToken,
  registerClient,
  sha256Base64Url,
} from './oauthMcp/common.test';
import { authorizeAndExchange } from './oauthMcp/flow.test';
import {
  testClientInitiatedNativeClientFlow,
  testAuthorizeValidation,
  testDenyFlow,
  testMetadata,
} from './oauthMcp/metadataAuthorization.test';
import { testClientMetadataDocumentSupport } from './oauthMcp/clientMetadata.test';
import { testInsufficientScope, testMcpTools, testProtocol } from './oauthMcp/protocolTools.test';
import { testLegacyRestNoteTypeCompatibility } from './oauthMcp/restCompatibility.test';
import {
  testPkceReuseAndAudience,
  testRefreshAndRevoke,
  testSingleUseTokenConcurrency,
} from './oauthMcp/tokenCases.test';

async function main() {
  console.log('Running OAuth MCP tests against ' + API_BASE);
  await ensureInitialized();
  const appAccessToken = await loginOrRegister();
  await testLegacyRestNoteTypeCompatibility(appAccessToken);
  await testMetadata();
  await testClientMetadataDocumentSupport();
  await testClientInitiatedNativeClientFlow(appAccessToken);
  const client = await registerClient();
  const codeChallenge = await sha256Base64Url(randomToken(48));
  await testAuthorizeValidation(client.client_id, codeChallenge);
  await testDenyFlow(appAccessToken, client.client_id, codeChallenge);

  const token = await authorizeAndExchange({
    appAccessToken,
    clientId: client.client_id,
    scopes: ALL_SCOPES,
  });
  await testPkceReuseAndAudience(appAccessToken, client.client_id);
  await testSingleUseTokenConcurrency(appAccessToken, client.client_id);
  await testProtocol(token.accessToken);
  await testMcpTools(token.accessToken);
  await testInsufficientScope(appAccessToken);
  await testRefreshAndRevoke(client.client_id, token.refreshToken);
  console.log('OAuth MCP tests passed');
}

main().catch((error) => {
  console.error('OAuth MCP tests failed:', error);
  process.exit(1);
});
