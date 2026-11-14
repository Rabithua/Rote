import {
  clientMetadataTestExports,
  fetchOAuthClientMetadataDocument,
} from '../../oauth/clientMetadata';
import { assertValidRedirectUri, isRegisteredRedirectUri } from '../../oauth/utils';
import { assert } from './common.test';

const { assertClientMetadataDocumentUrl, isNativePublicClientId } = clientMetadataTestExports;

export async function testClientMetadataDocumentSupport() {
  const clientId = 'https://client.example.com/oauth/client-metadata.json';
  assertClientMetadataDocumentUrl(clientId);
  assert(isNativePublicClientId('org.rcex.KeepTalkingApp'), 'native client id should be accepted');
  assertValidRedirectUri('ktoauth://oauth/callback');

  // RFC 8252 §7.3: loopback redirect URIs match across ports.
  assert(
    isRegisteredRedirectUri(['http://127.0.0.1:8765/callback'], 'http://127.0.0.1:53211/callback'),
    'loopback redirect should match with a different port'
  );
  assert(
    isRegisteredRedirectUri(['http://localhost/callback'], 'http://localhost:53211/callback'),
    'portless loopback redirect should match a port-embellished request'
  );
  assert(
    !isRegisteredRedirectUri(
      ['http://localhost:8765/oauth/callback'],
      'http://localhost:9999/wrong'
    ),
    'loopback redirect with a different path should not match'
  );
  assert(
    !isRegisteredRedirectUri(['https://example.com/callback'], 'https://example.com:8443/callback'),
    'non-loopback redirect port differences should not match'
  );

  for (const invalid of [
    'http://client.example.com/oauth/client-metadata.json',
    'https://client.example.com',
    'https://user:pass@client.example.com/oauth/client-metadata.json',
    'https://client.example.com/oauth/client-metadata.json#fragment',
    'https://client.example.com/oauth/../client-metadata.json',
  ]) {
    let rejected = false;
    try {
      assertClientMetadataDocumentUrl(invalid);
    } catch {
      rejected = true;
    }
    assert(rejected, 'invalid client metadata URL should be rejected: ' + invalid);
  }

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string) => {
    assert(url === clientId, 'metadata fetch URL mismatch');
    return new Response(
      JSON.stringify({
        client_id: clientId,
        client_name: 'Client Metadata Test',
        redirect_uris: ['http://127.0.0.1:8765/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'notes:read notes:write',
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  };

  try {
    const metadata = await fetchOAuthClientMetadataDocument(clientId);
    assert(metadata.client_id === clientId, 'metadata client_id mismatch');
    assert(metadata.client_name === 'Client Metadata Test', 'metadata client_name mismatch');
    assert(
      metadata.redirect_uris.includes('http://127.0.0.1:8765/callback'),
      'metadata redirect missing'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}
