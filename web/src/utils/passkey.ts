import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import { get, post, publicPost, del } from './api';

export function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn();
}

export async function registerWithPasskey(data: {
  username: string;
}): Promise<{ user: any; accessToken: string; refreshToken: string }> {
  // Step 1: validate user data, get passkey options
  const optionsRes = await publicPost('/auth/register/passkey/options', data);
  const { options, registrationToken } = optionsRes.data;

  // Step 2: browser WebAuthn ceremony
  const credential = await startRegistration({ optionsJSON: options });

  // Step 3: verify passkey + create account atomically
  const verifyRes = await publicPost('/auth/register/passkey/verify', {
    credential,
    registrationToken,
    deviceName: getDeviceName(),
  });

  return verifyRes.data;
}

export async function registerPasskey(): Promise<boolean> {
  const res = await post('/auth/passkey/register/options', {});
  const { options } = res.data;

  const credential = await startRegistration({ optionsJSON: options });

  await post('/auth/passkey/register/verify', {
    credential,
    deviceName: getDeviceName(),
  });

  return true;
}

export async function authenticateWithPasskey(): Promise<{
  user: any;
  accessToken: string;
  refreshToken: string;
}> {
  // Get authentication options from backend
  const res = await publicPost('/auth/passkey/authenticate/options', {});
  const { options, challengeKey } = res.data;

  // Trigger browser WebAuthn UI
  const credential = await startAuthentication({ optionsJSON: options });

  // Verify with backend and get tokens
  const verifyRes = await publicPost('/auth/passkey/authenticate/verify', {
    credential,
    challengeKey,
  });

  return verifyRes.data;
}

export async function listPasskeys() {
  const res = await get('/auth/passkey');
  return res.data;
}

export async function deletePasskey(id: string) {
  const res = await del(`/auth/passkey/${id}`);
  return res.data;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}
