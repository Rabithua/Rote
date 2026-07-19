import { v4 as uuidv4 } from 'uuid';
import { createAttachmentSource, createImportSource, dedupeNotesBySource } from './import-source';
import { normalizeContent, normalizeTags } from './shared';
import { importMessage } from '../messages';
import type {
  ConversionOptions,
  ConversionResult,
  Memo,
  MemoSourceData,
  RoteNote,
  RoteAttachment,
  SQLiteAttachment,
  SQLiteSourceData,
} from './types';

export function convertMemosToRote(
  data: MemoSourceData | SQLiteSourceData,
  selectedUserId?: number,
  options: ConversionOptions = {}
): ConversionResult {
  // 检查数据类型，区分是 JSON 还是 SQLite 格式
  // SQLite 格式有 users 属性，JSON 格式没有
  if ('users' in data && 'memos' in data) {
    // SQLite 格式
    return convertFromSQLite(data, selectedUserId, options);
  } else if ('memos' in data && Array.isArray(data.memos)) {
    // JSON 格式（保持原样）
    return convertFromJSON(data, options);
  } else {
    return {
      success: false,
      errors: [importMessage('errors.invalidData')],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 1,
        localAttachmentsSkipped: 0,
        articlesConverted: 0,
      },
    };
  }
}

function convertFromJSON(data: MemoSourceData, options: ConversionOptions): ConversionResult {
  const errors: Array<string> = [];
  const warnings: Array<string> = [];
  const notes: Array<RoteNote> = [];
  let localAttachmentsSkipped = 0;
  let emptyContentWithoutAttachmentsCount = 0;

  data.memos.forEach((memo, index) => {
    try {
      const { note, skippedLocalAttachments } = convertSingleMemo(
        memo,
        options,
        data.sourceAccount
      );

      // 检查是否没有附件且内容为空
      if (note.attachments.length === 0 && !note.content.trim()) {
        note.content = '';
        emptyContentWithoutAttachmentsCount++;
      }

      notes.push(note);
      localAttachmentsSkipped += skippedLocalAttachments;
    } catch (error) {
      errors.push(
        importMessage('errors.memosConvert', {
          index: index + 1,
          error: (error as Error).message,
        })
      );
    }
  });

  if (localAttachmentsSkipped > 0) {
    warnings.push(
      importMessage('warnings.memosLocalAttachments', {
        count: localAttachmentsSkipped,
      })
    );
  }

  if (emptyContentWithoutAttachmentsCount > 0) {
    warnings.push(
      importMessage('warnings.emptyNotes', {
        count: emptyContentWithoutAttachmentsCount,
      })
    );
  }

  const uniqueNotes = dedupeNotesBySource(notes);

  return {
    success: errors.length === 0,
    data: { formatVersion: 2, articles: [], notes: uniqueNotes },
    errors,
    warnings,
    stats: {
      total: data.memos.length,
      converted: uniqueNotes.length,
      failed: errors.length,
      localAttachmentsSkipped,
      articlesConverted: 0,
    },
  };
}

function convertFromSQLite(
  data: Partial<SQLiteSourceData>,
  selectedUserId?: number,
  options: ConversionOptions = {}
): ConversionResult {
  const errors: Array<string> = [];
  const warnings: Array<string> = [];
  const notes: Array<RoteNote> = [];
  let localAttachmentsSkipped = 0;

  // 确保必要的数据字段存在
  if (!data.memos || !Array.isArray(data.memos)) {
    return {
      success: false,
      errors: [importMessage('errors.noMemos')],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 0,
        localAttachmentsSkipped: 0,
        articlesConverted: 0,
      },
    };
  }

  if (!data.users || !Array.isArray(data.users)) {
    return {
      success: false,
      errors: [importMessage('errors.noMemosUsers')],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 0,
        localAttachmentsSkipped: 0,
        articlesConverted: 0,
      },
    };
  }

  const users = data.users;

  const sourceAttachments = Array.isArray(data.attachments) ? data.attachments : [];

  // 根据选择的用户筛选 memos
  let filteredMemos = data.memos;
  if (selectedUserId !== undefined) {
    filteredMemos = data.memos.filter((memo) => memo.creator_id === selectedUserId);
  }

  if (filteredMemos.length === 0) {
    return {
      success: false,
      errors: [importMessage('errors.noSelectedMemos')],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 0,
        localAttachmentsSkipped: 0,
        articlesConverted: 0,
      },
    };
  }

  // 获取用户信息（用于作者信息）
  const getUserInfo = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    return {
      username: user?.username || `user_${userId}`,
      nickname: user?.nickname || `User ${userId}`,
      avatar: user?.avatar_url || null,
    };
  };

  let emptyContentWithoutAttachmentsCount = 0;

  filteredMemos.forEach((memo, index) => {
    try {
      const memoAttachments = sourceAttachments.filter(
        (attachment) => attachment.memo_id === memo.id
      );
      const memoContent = typeof memo.content === 'string' ? memo.content : '';

      // 验证备忘录的基本字段
      if ((!memoContent.trim() && memoAttachments.length === 0) || !memo.visibility) {
        errors.push(importMessage('errors.memosMissingFields', { index: index + 1 }));
        return;
      }

      // 转换 SQLite Memo 格式到 RoteNote 格式
      const state = options.preserveVisibility ? convertVisibility(memo.visibility) : 'private';
      const userInfo = getUserInfo(memo.creator_id);
      const accountKey = data.sourceAccount ?? `${userInfo.username}:${memo.creator_id}`;
      const noteSource = createImportSource({
        provider: 'memos',
        accountKey,
        externalKey: memo.uid || String(memo.id),
        sourceUpdatedAt: new Date(memo.updated_ts * 1000).toISOString(),
      });

      // 获取 memo 相关的附件
      const { attachments: convertedAttachments, skippedCount } = convertSQLiteAttachments(
        memoAttachments,
        noteSource
      );
      localAttachmentsSkipped += skippedCount;

      const note: RoteNote = {
        id: uuidv4(),
        title: '',
        type: 'Rote',
        tags: normalizeTags(memo.payload?.tags, memoContent),
        content: normalizeContent(memoContent, options),
        state,
        archived: memo.row_status !== 'NORMAL',
        authorid: memo.creator_id.toString(),
        articleId: null,
        pin: memo.pinned,
        editor: 'normal',
        createdAt: new Date(memo.created_ts * 1000).toISOString(),
        updatedAt: new Date(memo.updated_ts * 1000).toISOString(),
        author: userInfo,
        attachments: convertedAttachments,
        reactions: [],
        source: noteSource,
      };

      // 检查是否没有附件且内容为空
      if (note.attachments.length === 0 && !note.content.trim()) {
        note.content = '';
        emptyContentWithoutAttachmentsCount++;
      }

      notes.push(note);
    } catch (error) {
      errors.push(
        importMessage('errors.memosConvert', {
          index: index + 1,
          error: (error as Error).message,
        })
      );
    }
  });

  if (localAttachmentsSkipped > 0) {
    warnings.push(
      importMessage('warnings.memosLocalAttachments', {
        count: localAttachmentsSkipped,
      })
    );
  }

  if (emptyContentWithoutAttachmentsCount > 0) {
    warnings.push(
      importMessage('warnings.emptyNotes', {
        count: emptyContentWithoutAttachmentsCount,
      })
    );
  }

  const uniqueNotes = dedupeNotesBySource(notes);

  return {
    success: errors.length === 0,
    data: { formatVersion: 2, articles: [], notes: uniqueNotes },
    errors,
    warnings,
    stats: {
      total: filteredMemos.length,
      converted: uniqueNotes.length,
      failed: errors.length,
      localAttachmentsSkipped,
      articlesConverted: 0,
    },
  };
}

function convertSQLiteAttachments(
  attachments: Array<SQLiteAttachment>,
  noteSource: RoteNote['source']
): {
  attachments: Array<RoteAttachment>;
  skippedCount: number;
} {
  // SQLite 附件转换逻辑
  const localAttachments = attachments.filter(
    (att) => att.storage_type === 'LOCAL' || !att.reference
  );
  const remoteAttachments = attachments.filter(
    (att) => att.storage_type !== 'LOCAL' && att.reference
  );

  const converted = remoteAttachments.map((att, index) => ({
    id: uuidv4(),
    url: att.reference,
    compressUrl: att.reference,
    userid: '',
    roteid: '',
    storage: 'REMOTE',
    details: {
      key: att.filename,
      size: att.size,
      mtime: new Date(att.created_ts * 1000).toISOString(),
      mimetype: att.type || 'application/octet-stream',
      compressKey: '',
    },
    createdAt: new Date(att.created_ts * 1000).toISOString(),
    updatedAt: new Date(att.updated_ts * 1000).toISOString(),
    sortIndex: 0,
    source: createAttachmentSource(noteSource, String(att.uid ?? att.id ?? att.reference ?? index)),
  }));

  return {
    attachments: converted,
    skippedCount: localAttachments.length,
  };
}

interface ConvertMemoResult {
  note: RoteNote;
  skippedLocalAttachments: number;
}

function convertSingleMemo(
  memo: Memo,
  options: ConversionOptions,
  sourceAccount?: string
): ConvertMemoResult {
  // 转换可见性
  const state = options.preserveVisibility ? convertVisibility(memo.visibility) : 'private';
  const noteSource = createImportSource({
    provider: 'memos',
    accountKey: sourceAccount ?? memo.creator,
    externalKey: memo.name,
    sourceUpdatedAt: memo.updateTime,
  });
  const { attachments, skippedCount } = convertAttachments(memo.attachments, noteSource);

  const note: RoteNote = {
    id: uuidv4(),
    title: '',
    type: 'Rote',
    tags: normalizeTags([...(memo.tags ?? []), ...(memo.property?.tags ?? [])], memo.content),
    content: normalizeContent(memo.content, options),
    state,
    archived: memo.state !== 'NORMAL',
    authorid: extractUserId(memo.creator),
    articleId: null,
    pin: memo.pinned,
    editor: 'normal',
    createdAt: memo.createTime,
    updatedAt: memo.updateTime,
    author: {
      username: `user_${extractUserId(memo.creator)}`,
      nickname: `User ${extractUserId(memo.creator)}`,
      avatar: null,
    },
    attachments,
    reactions: [],
    source: noteSource,
  };

  return { note, skippedLocalAttachments: skippedCount };
}

function convertVisibility(visibility: string): string {
  switch (visibility.toUpperCase()) {
    case 'PUBLIC':
      return 'public';
    case 'PRIVATE':
      return 'private';
    case 'PROTECTED':
      return 'private';
    default:
      return 'private';
  }
}

function extractUserId(creator: string): string {
  // 从格式 "users/{id}" 中提取用户 ID
  const match = creator.match(/users\/(\d+)/);
  return match ? match[1] : uuidv4();
}

interface ConvertAttachmentsResult {
  attachments: Array<any>;
  skippedCount: number;
}

function isLocalStorageAttachment(att: any): boolean {
  // 本地存储的附件通常是以 / 开头的相对路径，或者没有 http/https 协议
  const url = att.externalLink || att.url || '';
  if (!url) return true;
  return !url.startsWith('http://') && !url.startsWith('https://');
}

function convertAttachments(
  attachments: Array<any>,
  noteSource: RoteNote['source']
): ConvertAttachmentsResult {
  // 确保 attachments 是数组
  const safeAttachments = Array.isArray(attachments) ? attachments : [];

  // 过滤掉本地存储的附件
  const localAttachments = safeAttachments.filter(isLocalStorageAttachment);
  const remoteAttachments = safeAttachments.filter((att) => !isLocalStorageAttachment(att));

  const converted = remoteAttachments.map((att, index) => {
    const url = att.externalLink || att.url || '';
    return {
      id: uuidv4(),
      url,
      compressUrl: url,
      userid: '',
      roteid: '',
      storage: 'REMOTE',
      details: {
        key: att.filename || att.name || '',
        size: att.size || 0,
        mtime: new Date().toISOString(),
        mimetype: att.type || att.mimetype || 'application/octet-stream',
        compressKey: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortIndex: 0,
      source: createAttachmentSource(noteSource, String(att.name ?? att.id ?? url ?? index)),
    };
  });

  return {
    attachments: converted,
    skippedCount: localAttachments.length,
  };
}
