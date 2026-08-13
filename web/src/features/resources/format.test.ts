import { describe, expect, it } from 'vitest';
import { formatBytes, storageProgress } from './format';

describe('resource byte formatting', () => {
  it('formats decimal product quotas without binary-unit drift', () => {
    expect(formatBytes('500000000')).toBe('500 MB');
    expect(formatBytes('10000000000')).toBe('10 GB');
  });

  it('caps visual progress while preserving over-limit state separately', () => {
    expect(storageProgress('900000000', '200000000', '1000000000')).toBe(100);
  });
});
