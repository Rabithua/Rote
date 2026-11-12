import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import { get, post, publicPost, del } from './api';
import { authService } from './auth';

export function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn();
}

export async function registerPasskey(): Promise<boolean> {
  const accessToken = authService.getAccessToken();
  const accountId = accessToken && authService.getUserInfoFromToken(accessToken)?.userId;
  function assertCurrentAccount() {
    const currentToken = authService.getAccessToken();
    if (
      !accountId ||
      !currentToken ||
      authService.getUserInfoFromToken(currentToken)?.userId !== accountId
    ) {
      throw new DOMException('passkey_account_changed', 'AbortError');
    }
  }

  assertCurrentAccount();
  const res = await post('/auth/passkey/register/options', {});
  const { options } = res.data;
  assertCurrentAccount();

  const credential = await startRegistration({ optionsJSON: options });
  assertCurrentAccount();

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

// 删除账户确认：以当前用户的 Passkey 断言换取一次性删除授予令牌
export async function confirmDeletionWithPasskey(): Promise<string> {
  const accessToken = authService.getAccessToken();
  const accountId = accessToken && authService.getUserInfoFromToken(accessToken)?.userId;
  function assertCurrentAccount() {
    const currentToken = authService.getAccessToken();
    if (
      !accountId ||
      !currentToken ||
      authService.getUserInfoFromToken(currentToken)?.userId !== accountId
    ) {
      throw new DOMException('passkey_account_changed', 'AbortError');
    }
  }

  assertCurrentAccount();
  const res = await post('/auth/passkey/delete/options', {});
  const { options } = res.data;
  assertCurrentAccount();

  const credential = await startAuthentication({ optionsJSON: options });
  assertCurrentAccount();

  const verifyRes = await post('/auth/passkey/delete/verify', { credential });
  return verifyRes.data.deleteGrant as string;
}

// 仅本地开发：直接换取删除授予令牌（后端在生产环境返回 404）
export async function fetchMockDeleteGrant(): Promise<string> {
  const res = await post('/users/me/delete-grant/mock', {});
  return res.data.deleteGrant as string;
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
