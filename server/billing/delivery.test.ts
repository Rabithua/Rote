import { describe, expect, it } from 'bun:test';
import { classifyGrantRevision } from './delivery';

describe('billing grant revision ordering', () => {
  it('applies new and higher revisions', () => {
    expect(classifyGrantRevision(null, { revision: BigInt(1), snapshotHash: 'a' })).toBe('applied');
    expect(
      classifyGrantRevision(
        { revision: BigInt(1), snapshotHash: 'a' },
        { revision: BigInt(2), snapshotHash: 'b' }
      )
    ).toBe('applied');
  });

  it('ignores lower revisions and distinguishes duplicate from conflict', () => {
    const existing = { revision: BigInt(2), snapshotHash: 'same' };
    expect(classifyGrantRevision(existing, { revision: BigInt(1), snapshotHash: 'older' })).toBe(
      'ignored'
    );
    expect(classifyGrantRevision(existing, { revision: BigInt(2), snapshotHash: 'same' })).toBe(
      'duplicate'
    );
    expect(
      classifyGrantRevision(existing, { revision: BigInt(2), snapshotHash: 'different' })
    ).toBe('conflict');
  });
});
