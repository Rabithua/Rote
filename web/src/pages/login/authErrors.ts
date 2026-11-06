import axios from 'axios';

type AuthTranslator = (key: string) => string;

const errorTranslationKeys: Record<string, string> = {
  oauth_registration_expired: 'errors.oauthRegistrationExpired',
  oauth_registration_invalid: 'errors.oauthRegistrationInvalid',
  oauth_registration_conflict: 'errors.oauthRegistrationConflict',
  registration_disabled: 'errors.registrationDisabled',
  oauth_disabled: 'errors.oauthDisabled',
  passkey_disabled: 'errors.passkeyDisabled',
  username_unavailable: 'errors.usernameUnavailable',
  email_unavailable: 'errors.emailUnavailable',
  username_invalid: 'usernameFormat',
  registration_invalid: 'errors.registrationInvalid',
};

export function getAuthErrorMessage(error: unknown, t: AuthTranslator, fallbackKey: string) {
  const responseData = axios.isAxiosError(error)
    ? error.response?.data
    : (error as { response?: { data?: { errorCode?: string; message?: string } } })?.response?.data;
  const key = responseData?.errorCode && errorTranslationKeys[responseData.errorCode];
  return key ? t(key) : responseData?.message || t(fallbackKey);
}

export function getOAuthCallbackError(errorCode: string | null, t: AuthTranslator) {
  const key = errorCode && errorTranslationKeys[errorCode];
  return key ? t(key) : null;
}
