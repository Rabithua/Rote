export interface MemoSourceData {
  memos: Array<Memo>;
  nextPageToken: string;
  sourceAccount?: string;
}

export interface ConversionOptions {
  cleanMarkdown?: boolean;
  preserveVisibility?: boolean;
}

export interface SQLiteSourceData {
  users: Array<User>;
  memos: Array<SQLiteMemo>;
  attachments: Array<SQLiteAttachment>;
  sourceAccount?: string;
}

export type ImportProvider = 'flomo' | 'memos' | 'weread';

export interface RoteImportSource {
  provider: ImportProvider;
  accountId: string;
  externalId: string;
  sourceUpdatedAt?: string;
}

export interface FlomoSourceData {
  html: string;
  filename?: string;
}

export interface WereadSourceData {
  meta: WereadBookMeta;
  content: Array<WereadChapter>;
}

export interface WereadApiSourceData {
  books: Array<WereadSourceData>;
}

export interface WereadTextSourceData {
  text: string;
  filename?: string;
}

export interface WereadBookMeta {
  bookId?: string;
  title: string;
  author?: string;
  category?: string;
}

export interface WereadChapter {
  chapterUid?: number | string;
  chapterTitle?: string;
  items: Array<WereadNoteItem>;
}

export interface WereadNoteItem {
  type: 'highlight' | 'review';
  bookmarkId?: string;
  reviewId?: string;
  markText?: string;
  abstract?: string;
  content?: string;
  createTime?: number | string;
  createTimeFormatted?: string;
}

export interface User {
  id: number;
  created_ts: number;
  updated_ts: number;
  row_status: string;
  username: string;
  role: string;
  email: string;
  nickname: string;
  avatar_url: string;
  description: string;
}

export interface SQLiteMemo {
  id: number;
  uid: string;
  creator_id: number;
  created_ts: number;
  updated_ts: number;
  row_status: string;
  content: string;
  visibility: string;
  pinned: boolean;
  payload: any;
}

export interface SQLiteAttachment {
  id: number;
  uid: string;
  creator_id: number;
  created_ts: number;
  updated_ts: number;
  filename: string;
  blob: any;
  type: string;
  size: number;
  memo_id: number;
  storage_type: string;
  reference: string;
  payload: any;
}

export interface Memo {
  name: string;
  state: string;
  creator: string;
  createTime: string;
  updateTime: string;
  displayTime: string;
  content: string;
  visibility: string;
  tags?: Array<string>;
  pinned: boolean;
  attachments: Array<any>;
  relations: Array<any>;
  reactions: Array<any>;
  property?: {
    hasLink: boolean;
    hasTaskList: boolean;
    hasCode: boolean;
    hasIncompleteTasks: boolean;
    tags?: Array<string>;
  };
  snippet: string;
  location?: unknown;
}

export interface RoteArticle {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoteOutputData {
  formatVersion: 2;
  articles: Array<RoteArticle>;
  notes: Array<RoteNote>;
}

export interface RoteNote {
  id: string;
  title: string;
  type: string;
  tags: Array<string>;
  content: string;
  state: string;
  archived: boolean;
  authorid: string;
  articleId: string | null;
  pin: boolean;
  editor: string;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    nickname: string;
    avatar: string | null;
  };
  attachments: Array<RoteAttachment>;
  reactions: Array<any>;
  source: RoteImportSource;
}

export interface RoteAttachment {
  id: string;
  url: string;
  compressUrl: string;
  userid: string;
  roteid: string;
  storage: string;
  details: {
    key: string;
    size: number;
    mtime: string;
    mimetype: string;
    compressKey: string;
  };
  createdAt: string;
  updatedAt: string;
  sortIndex: number;
  source?: RoteImportSource;
}

export interface ConversionResult {
  success: boolean;
  data?: RoteOutputData;
  errors: Array<string>;
  warnings: Array<string>;
  stats: {
    total: number;
    converted: number;
    failed: number;
    localAttachmentsSkipped: number;
    articlesConverted: number;
  };
}
