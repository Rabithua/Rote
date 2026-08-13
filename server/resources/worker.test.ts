import { describe, expect, it } from 'bun:test';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const { attachmentObjects, inspectReconciledObjects, isolateReconciliationFailure } =
  await import('./worker');

describe('resource maintenance isolation', () => {
  it('counts a Live Photo original reused as its browser cover only once', () => {
    expect(
      attachmentObjects(
        {
          key: 'users/user-1/uploads/live.jpg',
          compressKey: 'users/user-1/uploads/live.jpg',
        },
        'user-1'
      )
    ).toEqual([
      {
        key: 'users/user-1/uploads/live.jpg',
        role: 'original',
        billable: true,
        references: 1,
      },
    ]);
  });
  it('contains reconciliation errors so later maintenance can continue', async () => {
    let observed: unknown;
    await expect(
      isolateReconciliationFailure(
        async () => {
          throw new Error('head failed');
        },
        (error) => {
          observed = error;
        }
      )
    ).resolves.toBeUndefined();
    expect(observed).toBeInstanceOf(Error);
  });

  it('counts existing physical objects and skips stale missing legacy references', async () => {
    const objects = [
      { key: 'present', role: 'original' as const, billable: true, references: 1 },
      { key: 'missing', role: 'compressed' as const, billable: false, references: 1 },
    ];
    const result = await inspectReconciledObjects(
      objects,
      async (key) =>
        key === 'present' ? { contentLength: 123, contentType: 'image/jpeg', etag: 'etag' } : null,
      2
    );

    expect(result).toEqual({
      inspected: [{ ...objects[0], actualBytes: 123n }],
      missingCount: 1,
    });
  });

  it('keeps unknown object sizes fail-closed', async () => {
    await expect(
      inspectReconciledObjects(
        [{ key: 'unknown', role: 'original', billable: true, references: 1 }],
        async () => ({ contentLength: null, contentType: null, etag: null })
      )
    ).rejects.toThrow('storage_object_size_unknown');
  });
});
