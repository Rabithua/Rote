import messages from './registrationMessages.json';

export type OAuthRegistrationErrorCode = keyof typeof messages;

const errorStatuses: Record<OAuthRegistrationErrorCode, 400 | 403 | 409 | 410> = {
  oauth_registration_expired: 410,
  registration_disabled: 403,
  oauth_disabled: 403,
  username_unavailable: 409,
  username_invalid: 400,
  oauth_registration_conflict: 409,
  oauth_registration_invalid: 400,
};

export class OAuthRegistrationError extends Error {
  readonly status: 400 | 403 | 409 | 410;

  constructor(readonly code: OAuthRegistrationErrorCode) {
    super(messages[code]);
    this.name = 'OAuthRegistrationError';
    this.status = errorStatuses[code];
  }
}
