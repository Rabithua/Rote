import { describe, expect, it } from 'bun:test';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const {
  attachmentDeclaredBytes,
  resolveUnboundAttachmentCleanupMode,
  UNBOUND_ATTACHMENT_CLEANUP_BATCH_SIZE,
  UNBOUND_ATTACHMENT_RETENTION_MS,
} = await import('./unboundCleanup');

describe('unbound attachment cleanup policy', () => {
  it('defaults to observe and requires an explicit enforce value', () => {
    expect(resolveUnboundAttachmentCleanupMode(undefined)).toBe('observe');
    expect(resolveUnboundAttachmentCleanupMode('observe')).toBe('observe');
    expect(resolveUnboundAttachmentCleanupMode('ENFORCE')).toBe('enforce');
    expect(resolveUnboundAttachmentCleanupMode('unexpected')).toBe('observe');
  });

  it('uses the agreed seven-day retention and bounded batch size', () => {
    expect(UNBOUND_ATTACHMENT_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(UNBOUND_ATTACHMENT_CLEANUP_BATCH_SIZE).toBe(100);
  });

  it('reports only safe declared byte counts', () => {
    expect(attachmentDeclaredBytes({ size: 123 })).toBe(123n);
    expect(attachmentDeclaredBytes({ size: -1 })).toBe(0n);
    expect(attachmentDeclaredBytes({ size: Number.MAX_SAFE_INTEGER + 1 })).toBe(0n);
    expect(attachmentDeclaredBytes(null)).toBe(0n);
  });
});
