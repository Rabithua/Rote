export const GIFT_API_ERROR_CODES = [
  'gift_invalid_request',
  'gift_campaign_not_found',
  'gift_not_available',
] as const;

export type GiftApiErrorCode = (typeof GIFT_API_ERROR_CODES)[number];

export class GiftApiError extends Error {
  constructor(
    readonly code: GiftApiErrorCode,
    readonly status: 400 | 404
  ) {
    super(code);
    this.name = 'GiftApiError';
  }
}
