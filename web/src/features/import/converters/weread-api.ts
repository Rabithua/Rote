import type { FetchProgress } from './memos-api';
import { importMessage } from '../messages';
import { post } from '@/utils/api';
import type { WereadApiSourceData, WereadBookMeta, WereadChapter, WereadNoteItem } from './types';

const API_URL = '/imports/weread';
const SKILL_VERSION = '1.0.4';
const REQUEST_TIMEOUT_MS = 35_000;

interface GatewayResponse {
  errcode?: number;
  errmsg?: string;
  upgrade_info?: { message?: string };
  [key: string]: unknown;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface NotebookBook {
  bookId: string;
  sort?: number;
  noteCount?: number;
  reviewCount?: number;
  bookmarkCount?: number;
  book?: WereadBookMeta;
}

interface NotebooksResponse extends GatewayResponse {
  books?: Array<NotebookBook>;
  hasMore?: number;
}

interface BookmarkResponse extends GatewayResponse {
  updated?: Array<Record<string, unknown>>;
  chapters?: Array<Record<string, unknown>>;
  book?: WereadBookMeta;
}

interface ReviewsResponse extends GatewayResponse {
  reviews?: Array<{ review?: Record<string, unknown> }>;
  hasMore?: number;
  synckey?: number;
}

export async function fetchWereadFromApi(
  apiKey: string,
  onProgress?: (progress: FetchProgress) => void
): Promise<WereadApiSourceData> {
  const notebooks = (await fetchAllNotebooks(apiKey, onProgress)).filter(
    hasExportableNotebookContent
  );
  if (notebooks.length === 0) {
    throw new Error(importMessage('errors.noWereadExportableNotes'));
  }

  const books = [];

  for (let index = 0; index < notebooks.length; index++) {
    const notebook = notebooks[index];
    onProgress?.({
      current: index,
      total: notebooks.length,
      message: importMessage('progress.wereadBook', {
        title: notebook.book?.title ?? notebook.bookId,
      }),
    });

    const shouldFetchHighlights = !isKnownCount(notebook.noteCount) || notebook.noteCount > 0;
    const shouldFetchReviews = !isKnownCount(notebook.reviewCount) || notebook.reviewCount > 0;
    const [bookmarkData, reviewItems] = await Promise.all([
      shouldFetchHighlights
        ? gatewayRequest<BookmarkResponse>(apiKey, '/book/bookmarklist', {
            bookId: notebook.bookId,
          })
        : Promise.resolve<BookmarkResponse>({ book: notebook.book }),
      shouldFetchReviews ? fetchAllReviews(apiKey, notebook.bookId) : Promise.resolve([]),
    ]);

    const book = buildBookSource(notebook, bookmarkData, reviewItems);
    if (book.content.length > 0) books.push(book);
  }

  if (books.length === 0) {
    throw new Error(importMessage('errors.noWereadExportableNotes'));
  }

  onProgress?.({
    current: books.length,
    total: books.length,
    message: importMessage('progress.wereadComplete', { count: books.length }),
  });
  return { books };
}

async function fetchAllNotebooks(
  apiKey: string,
  onProgress?: (progress: FetchProgress) => void
): Promise<Array<NotebookBook>> {
  const books: Array<NotebookBook> = [];
  let lastSort: number | undefined;
  let hasMore: boolean;

  do {
    onProgress?.({
      current: books.length,
      total: null,
      message: importMessage('progress.wereadNotebooks'),
    });
    const response = await gatewayRequest<NotebooksResponse>(apiKey, '/user/notebooks', {
      count: 100,
      ...(lastSort === undefined ? {} : { lastSort }),
    });
    const page = Array.isArray(response.books) ? response.books : [];
    books.push(...page.filter((book) => typeof book.bookId === 'string'));

    hasMore = response.hasMore === 1 && page.length > 0;
    if (hasMore) {
      const nextSort = page[page.length - 1].sort;
      if (typeof nextSort !== 'number' || nextSort === lastSort) {
        throw new Error(importMessage('errors.wereadNotebookCursor'));
      }
      lastSort = nextSort;
    }
  } while (hasMore);

  if (books.length === 0) throw new Error(importMessage('errors.noWereadNotebooks'));
  return books;
}

function hasExportableNotebookContent(notebook: NotebookBook): boolean {
  if (!isKnownCount(notebook.noteCount) || !isKnownCount(notebook.reviewCount)) {
    return true;
  }
  return notebook.noteCount > 0 || notebook.reviewCount > 0;
}

async function fetchAllReviews(
  apiKey: string,
  bookId: string
): Promise<Array<Record<string, unknown>>> {
  const reviews: Array<Record<string, unknown>> = [];
  let synckey = 0;
  let hasMore: boolean;

  do {
    const response = await gatewayRequest<ReviewsResponse>(apiKey, '/review/list/mine', {
      bookid: bookId,
      count: 100,
      synckey,
    });
    reviews.push(...(response.reviews ?? []).flatMap((item) => (item.review ? [item.review] : [])));
    hasMore = response.hasMore === 1;
    if (hasMore) {
      if (typeof response.synckey !== 'number' || response.synckey === synckey) {
        throw new Error(importMessage('errors.wereadReviewCursor'));
      }
      synckey = response.synckey;
    }
  } while (hasMore);

  return reviews;
}

function buildBookSource(
  notebook: NotebookBook,
  bookmarkData: BookmarkResponse,
  reviews: Array<Record<string, unknown>>
) {
  const sourceMeta = bookmarkData.book ?? notebook.book;
  const chapterTitles = new Map<string, string>();
  for (const chapter of bookmarkData.chapters ?? []) {
    if (chapter.chapterUid !== undefined && typeof chapter.title === 'string') {
      chapterTitles.set(String(chapter.chapterUid), chapter.title);
    }
  }

  const chapters = new Map<string, WereadChapter>();
  const addItem = (chapterUid: unknown, chapterTitle: unknown, item: WereadNoteItem) => {
    const key = chapterUid === undefined ? 'book' : String(chapterUid);
    const existing = chapters.get(key) ?? {
      chapterUid:
        typeof chapterUid === 'string' || typeof chapterUid === 'number' ? chapterUid : undefined,
      chapterTitle:
        typeof chapterTitle === 'string' ? chapterTitle : (chapterTitles.get(key) ?? ''),
      items: [],
    };
    existing.items.push(item);
    chapters.set(key, existing);
  };

  for (const bookmark of bookmarkData.updated ?? []) {
    if (typeof bookmark.markText !== 'string') continue;
    addItem(bookmark.chapterUid, undefined, {
      type: 'highlight',
      bookmarkId: stringValue(bookmark.bookmarkId),
      markText: bookmark.markText,
      createTime: timeValue(bookmark.createTime),
    });
  }

  for (const review of reviews) {
    if (typeof review.content !== 'string' && typeof review.abstract !== 'string') continue;
    addItem(review.chapterUid, review.chapterName, {
      type: 'review',
      reviewId: stringValue(review.reviewId),
      content: stringValue(review.content),
      abstract: stringValue(review.abstract),
      createTime: timeValue(review.createTime),
    });
  }

  return {
    meta: sourceMeta
      ? { ...sourceMeta, bookId: sourceMeta.bookId ?? notebook.bookId }
      : { title: notebook.bookId, bookId: notebook.bookId },
    content: [...chapters.values()],
  };
}

async function gatewayRequest<T extends GatewayResponse>(
  apiKey: string,
  apiName: string,
  parameters: Record<string, unknown>
): Promise<T> {
  let response: ApiResponse<T>;
  try {
    response = await post<ApiResponse<T>>(
      API_URL,
      {
        api_name: apiName,
        ...parameters,
        skill_version: SKILL_VERSION,
      },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'X-WeRead-API-Key': apiKey.trim(),
        },
      }
    );
  } catch (error) {
    const code = getGatewayErrorCode(error);
    if (code === 'weread_invalid_key') {
      throw new Error(importMessage('errors.wereadUnauthorized'));
    }
    if (code === 'weread_timeout') {
      throw new Error(importMessage('errors.wereadTimeout'));
    }
    if (code === 'weread_api_forbidden') {
      throw new Error(importMessage('errors.wereadApiForbidden'));
    }
    throw new Error(importMessage('errors.wereadUnreachable'));
  }

  const data = response.data;
  if (data.upgrade_info) {
    throw new Error(data.upgrade_info.message ?? importMessage('errors.wereadUpgrade'));
  }
  if (typeof data.errcode === 'number' && data.errcode !== 0) {
    throw new Error(data.errmsg || importMessage('errors.wereadApiError', { code: data.errcode }));
  }
  return data;
}

function getGatewayErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : '';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function timeValue(value: unknown): number | string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function isKnownCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
