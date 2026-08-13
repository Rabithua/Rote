import { describe, expect, it } from 'bun:test';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const { attachmentObjects, isolateReconciliationFailure } = await import('./worker');

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
});
