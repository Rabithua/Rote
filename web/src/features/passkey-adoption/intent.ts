import { authService } from '@/utils/auth';
import { isOAuthAuthorizeRedirect } from '@/utils/loginRedirect';

const INTENT_KEY = 'rote-passkey-adoption';
const OFFERED_KEY_PREFIX = 'rote-passkey-adoption-offered:';
const INTENT_LIFETIME = 10 * 60 * 1000;
const OFFER_COOLDOWN = 30 * 24 * 60 * 60 * 1000;

type PasskeyAdoptionIntent = { accountId: string; createdAt: number };

export function queuePasskeyAdoption(accessToken: string, redirect: string, isIosLogin: boolean) {
  if (isIosLogin || isOAuthAuthorizeRedirect(redirect)) return;
  const accountId = authService.getUserInfoFromToken(accessToken)?.userId;
  if (accountId) {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ accountId, createdAt: Date.now() }));
  }
}

export function readPasskeyAdoptionIntent(): PasskeyAdoptionIntent | null {
  const stored = sessionStorage.getItem(INTENT_KEY);
  if (!stored) return null;
  let intent: PasskeyAdoptionIntent;
  try {
    intent = JSON.parse(stored) as PasskeyAdoptionIntent;
  } catch {
    sessionStorage.removeItem(INTENT_KEY);
    return null;
  }
  if (
    !intent ||
    typeof intent.accountId !== 'string' ||
    !Number.isFinite(intent.createdAt) ||
    Date.now() - intent.createdAt > INTENT_LIFETIME
  ) {
    sessionStorage.removeItem(INTENT_KEY);
    return null;
  }
  return intent;
}

export function consumePasskeyAdoptionIntent(accountId: string): boolean {
  const intent = readPasskeyAdoptionIntent();
  if (!intent || intent.accountId !== accountId) return false;
  sessionStorage.removeItem(INTENT_KEY);
  return true;
}

export function shouldOfferPasskeyAdoption(accountId: string): boolean {
  const lastOffered = Number(localStorage.getItem(`${OFFERED_KEY_PREFIX}${accountId}`));
  return !lastOffered || Date.now() - lastOffered >= OFFER_COOLDOWN;
}

export function markPasskeyAdoptionOffered(accountId: string) {
  localStorage.setItem(`${OFFERED_KEY_PREFIX}${accountId}`, String(Date.now()));
}
