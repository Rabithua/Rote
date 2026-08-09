import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteArticle } from '@/utils/articleApi';

import { useArticleActions } from './useArticleActions';

vi.mock('@/utils/articleApi', () => ({
  deleteArticle: vi.fn(),
}));

describe('useArticleActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires confirmation before deleting an article', async () => {
    vi.mocked(deleteArticle).mockResolvedValue({} as never);
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useArticleActions({ articleId: 'article-id', onDeleted }));

    act(() => result.current.handleDelete());

    expect(result.current.isDeleteConfirmOpen).toBe(true);
    expect(deleteArticle).not.toHaveBeenCalled();

    await act(async () => result.current.confirmDelete());

    expect(deleteArticle).toHaveBeenCalledWith('article-id');
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(result.current.isDeleteConfirmOpen).toBe(false);
  });

  it('keeps the confirmation open when deletion fails', async () => {
    vi.mocked(deleteArticle).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useArticleActions({ articleId: 'article-id' }));

    act(() => result.current.handleDelete());
    await act(async () => result.current.confirmDelete());

    await waitFor(() => expect(result.current.isDeleting).toBe(false));
    expect(result.current.isDeleteConfirmOpen).toBe(true);
  });
});
