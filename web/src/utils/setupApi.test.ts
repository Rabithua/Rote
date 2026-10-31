import { beforeEach, describe, expect, it, vi } from 'vitest';
import { regenerateKeys } from './setupApi';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('./api', () => ({ post, get: vi.fn(), put: vi.fn() }));

describe('administrator key rotation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults to rotating authentication keys without changing push subscriptions', () => {
    regenerateKeys();
    expect(post).toHaveBeenCalledExactlyOnceWith('/admin/settings/regenerate-keys', {
      scope: 'authentication',
    });
  });

  it('retains the explicit ability to rotate all security keys', () => {
    regenerateKeys('all');
    expect(post).toHaveBeenCalledExactlyOnceWith('/admin/settings/regenerate-keys', {
      scope: 'all',
    });
  });
});
