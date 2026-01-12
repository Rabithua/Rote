import type { Article, ArticleSummary } from '@/types/main';
import { del, get, post, put } from './api';

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export const listMyArticles = (params?: { skip?: number; limit?: number; keyword?: string }) =>
  get<ApiResponse<Article[]>>('/articles', params).then((res) => res.data);

export const createArticle = (data: { content: string }) =>
  post<ApiResponse<Article>>('/articles', data).then((res) => res.data);

export const updateArticle = (id: string, data: Partial<{ content: string }>) =>
  put<ApiResponse<Article>>(`/articles/${id}`, data).then((res) => res.data);

export const deleteArticle = (id: string) =>
  del<ApiResponse<Article>>(`/articles/${id}`).then((res) => res.data);

// 获取笔记绑定的文章摘要（一对一）
export const getNoteArticle = (noteId: string) =>
  get<ApiResponse<ArticleSummary | null>>(`/articles/by-note/${noteId}`).then((res) => res.data);

export const getArticleFull = (id: string, noteId?: string) =>
  get<ApiResponse<Article>>(`/articles/${id}`, noteId ? { noteId } : undefined).then(
    (res) => res.data
  );

// 更新笔记的文章绑定（一对一）
export const setNoteArticle = (noteId: string, articleId: string | null) =>
  post<ApiResponse<ArticleSummary | null>>(`/articles/refs/${noteId}`, { articleId }).then(
    (res) => res.data
  );
