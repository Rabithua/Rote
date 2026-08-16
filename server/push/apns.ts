import * as http2 from 'node:http2';
import { importPKCS8, SignJWT } from 'jose';
import type { ApnsEnvironment } from './config';
import { getApnsConfig } from './config';

let cachedToken: { value: string; expiresAt: number; signature: string } | null = null;
const clients = new Map<string, http2.ClientHttp2Session>();
const requestTimeoutMs = 15_000;

function apnsClient(origin: string): http2.ClientHttp2Session {
  const existing = clients.get(origin);
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const client = http2.connect(origin);
  clients.set(origin, client);
  client.on('error', () => {
    if (clients.get(origin) === client) clients.delete(origin);
  });
  client.on('close', () => {
    if (clients.get(origin) === client) clients.delete(origin);
  });
  return client;
}

async function providerToken(environment: ApnsEnvironment): Promise<string> {
  const config = getApnsConfig(environment);
  const signature = `${config.teamId}:${config.keyId}:${config.privateKey}`;
  if (cachedToken && cachedToken.signature === signature && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  const key = await importPKCS8(config.privateKey, 'ES256');
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt()
    .sign(key);
  cachedToken = { value, expiresAt: Date.now() + 50 * 60 * 1000, signature };
  return value;
}

export type ApnsMessage = {
  token: string;
  environment: ApnsEnvironment;
  title?: string | null;
  body?: string | null;
  titleLocKey?: string | null;
  bodyLocKey?: string | null;
  route?: string | null;
  payload?: Record<string, unknown>;
  expiration?: Date | null;
  collapseId?: string;
};

export async function sendApns(message: ApnsMessage): Promise<{ apnsId?: string }> {
  const config = getApnsConfig(message.environment);
  const authorization = await providerToken(message.environment);
  const alert: Record<string, string> = {};
  if (message.title) alert.title = message.title;
  if (message.body) alert.body = message.body;
  if (message.titleLocKey) alert['title-loc-key'] = message.titleLocKey;
  if (message.bodyLocKey) alert['loc-key'] = message.bodyLocKey;
  const body = JSON.stringify({
    ...message.payload,
    aps: { alert, sound: 'default' },
    route: message.route,
  });

  return await new Promise((resolve, reject) => {
    const client = apnsClient(config.origin);
    const headers: http2.OutgoingHttpHeaders = {
      ':method': 'POST',
      ':path': `/3/device/${message.token}`,
      authorization: `bearer ${authorization}`,
      'apns-topic': config.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(
        message.expiration ? Math.floor(message.expiration.getTime() / 1000) : 0
      ),
    };
    if (message.collapseId) headers['apns-collapse-id'] = message.collapseId;
    const request = client.request(headers);
    let settled = false;
    let responseBody = '';
    let status = 0;
    let apnsId: string | undefined;
    request.setEncoding('utf8');
    request.on('response', (responseHeaders) => {
      status = Number(responseHeaders[':status'] ?? 0);
      apnsId = responseHeaders['apns-id'] as string | undefined;
    });
    request.on('data', (chunk) => (responseBody += chunk));
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      request.close(http2.constants.NGHTTP2_CANCEL);
      client.destroy();
      reject(new Error('APNs request timed out'));
    }, requestTimeoutMs);
    request.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (status === 200) return resolve({ apnsId });
      let reason = `APNs HTTP ${status}`;
      try {
        reason = JSON.parse(responseBody).reason ?? reason;
      } catch {}
      reject(Object.assign(new Error(reason), { status, apnsId }));
    });
    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    request.end(body);
  });
}
