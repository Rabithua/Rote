import messages from './messages.json';

export type AccountMergeErrorCode = Exclude<keyof typeof messages, 'oauth_merge_success'>;

const statuses = {
  oauth_merge_invalid_request: 400,
  oauth_merge_authorization_required: 403,
  oauth_merge_conflict: 409,
  oauth_merge_billing_blocked: 409,
  oauth_merge_disabled: 403,
  oauth_merge_failed: 500,
} as const;

export class AccountMergeError extends Error {
  readonly status;

  constructor(readonly code: AccountMergeErrorCode) {
    super(messages[code]);
    this.name = 'AccountMergeError';
    this.status = statuses[code];
  }
}
