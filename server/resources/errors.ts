export const RESOURCE_ERROR_CODES = {
  storageQuotaExceeded: 'resource_storage_quota_exceeded',
  uploadReservationExpired: 'resource_upload_reservation_expired',
  uploadManifestMismatch: 'resource_upload_manifest_mismatch',
  openKeyCreationBlocked: 'resource_openkey_creation_blocked',
  storageReconciliationRequired: 'resource_storage_reconciliation_required',
  storageBackendUnsupported: 'resource_storage_backend_unsupported',
} as const;

export class ResourcePolicyError extends Error {
  constructor(
    public readonly code: (typeof RESOURCE_ERROR_CODES)[keyof typeof RESOURCE_ERROR_CODES],
    public readonly status: 409 | 413 | 503 = 409
  ) {
    super(code);
    this.name = 'ResourcePolicyError';
  }
}
