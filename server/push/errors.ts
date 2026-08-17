export const PUSH_API_ERROR_CODES = [
  'push_not_available',
  'push_invalid_request',
  'push_invalid_time_zone',
  'push_device_not_found',
  'push_device_registration_required',
  'push_campaign_not_found',
  'push_campaign_already_sent',
] as const;

export type PushApiErrorCode = (typeof PUSH_API_ERROR_CODES)[number];

export class PushApiError extends Error {
  constructor(
    readonly code: PushApiErrorCode,
    readonly status: 400 | 404 | 409
  ) {
    super(code);
    this.name = 'PushApiError';
  }
}
