import { v4 as uuidv4 } from 'uuid';

import { createImportSource, dedupeNotesBySource } from './import-source';
import { normalizeContent, normalizeTags } from './shared';
import { importMessage } from '../messages';
import type {
  ConversionOptions,
  ConversionResult,
  RoteNote,
  WereadApiSourceData,
  WereadBookMeta,
  WereadNoteItem,
  WereadSourceData,
  WereadTextSourceData,
} from './types';

type WereadInput = WereadApiSourceData | WereadSourceData | WereadTextSourceData;

interface NormalizedWereadNote {
  book: WereadBookMeta;
  chapterUid?: number | string;
  chapterTitle: string;
  item: WereadNoteItem;
}

const NOTE_COUNT_PATTERN = /^\d+\s*个笔记$/u;
const CHAPTER_PATTERN = /^◆\s*(.+)$/u;
const QUOTE_PATTERN = /^>{1,2}\s*(.*)$/u;
const IMAGE_PLACEHOLDER_PATTERN = /\[(?:图片|插图)\]/gu;

interface SanitizedWereadNotes {
  notes: Array<NormalizedWereadNote>;
  placeholderCount: number;
  skippedImageOnlyCount: number;
}

export function convertWereadToRote(
  data: unknown,
  _selectedUserId?: number,
  options: ConversionOptions = {}
): ConversionResult {
  if (!isWereadSourceData(data)) {
    return failedResult(importMessage('errors.invalidWeread'));
  }

  const rawNotes =
    'text' in data
      ? parseWereadText(data.text)
      : 'books' in data
        ? data.books.flatMap(flattenJson)
        : flattenJson(data);
  const {
    notes: normalizedNotes,
    placeholderCount,
    skippedImageOnlyCount,
  } = sanitizeImagePlaceholders(rawNotes);

  if (normalizedNotes.length === 0) {
    if (skippedImageOnlyCount > 0) {
      return failedImageOnlyResult(rawNotes.length, placeholderCount);
    }
    return failedResult(importMessage('errors.noWereadNotes'));
  }

  const notes: Array<RoteNote> = [];
  const errors: Array<string> = [];

  normalizedNotes.forEach((source, index) => {
    try {
      notes.push(convertNote(source, options));
    } catch (error) {
      errors.push(
        importMessage('errors.wereadConvert', {
          title: source.book.title || 'WeRead',
          index: index + 1,
          error: (error as Error).message,
        })
      );
    }
  });

  const uniqueNotes = dedupeNotesBySource(notes);

  return {
    success: errors.length === 0,
    data: { formatVersion: 2, articles: [], notes: uniqueNotes },
    errors,
    warnings:
      placeholderCount > 0
        ? [imagePlaceholderWarning(placeholderCount, skippedImageOnlyCount)]
        : [],
    stats: {
      total: rawNotes.length,
      converted: uniqueNotes.length,
      failed: errors.length,
      localAttachmentsSkipped: placeholderCount,
      articlesConverted: 0,
    },
  };
}

export function isWereadSourceData(data: unknown): data is WereadInput {
  if (!data || typeof data !== 'object') return false;

  const record = data as Record<string, unknown>;
  if (Array.isArray(record.books)) {
    return record.books.length > 0 && record.books.every(isStructuredSourceData);
  }
  if (typeof record.text === 'string') {
    return looksLikeWereadText(record.text);
  }

  return isStructuredSourceData(record);
}

function isStructuredSourceData(data: unknown): data is WereadSourceData {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (!record.meta || typeof record.meta !== 'object' || !Array.isArray(record.content)) {
    return false;
  }

  const meta = record.meta as Record<string, unknown>;
  return (
    typeof meta.title === 'string' &&
    record.content.every(
      (chapter) =>
        !!chapter &&
        typeof chapter === 'object' &&
        Array.isArray((chapter as Record<string, unknown>).items)
    )
  );
}

function flattenJson(data: WereadSourceData): Array<NormalizedWereadNote> {
  return data.content.flatMap((chapter) =>
    chapter.items.flatMap((item) =>
      isValidItem(item)
        ? [
            {
              book: data.meta,
              chapterUid: chapter.chapterUid,
              chapterTitle: chapter.chapterTitle?.trim() ?? '',
              item,
            },
          ]
        : []
    )
  );
}

function parseWereadText(text: string): Array<NormalizedWereadNote> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const nonEmptyHeader = lines.map((line) => line.trim()).filter(Boolean);
  const noteCountIndex = nonEmptyHeader.findIndex((line) => NOTE_COUNT_PATTERN.test(line));
  const title = nonEmptyHeader[0] ?? '微信读书';
  const author = noteCountIndex > 1 ? nonEmptyHeader[noteCountIndex - 1] : undefined;
  const book: WereadBookMeta = { title, author };
  const notes: Array<NormalizedWereadNote> = [];
  let chapterTitle = '';
  let pendingThought: Array<string> = [];

  const flushThought = () => {
    const content = pendingThought.join('\n').trim();
    if (content) {
      notes.push({ book, chapterTitle, item: { type: 'review', content } });
    }
    pendingThought = [];
  };

  for (const rawLine of lines.slice(noteCountIndex >= 0 ? noteCountIndex + 1 : 0)) {
    const line = rawLine.trim();
    const chapterMatch = line.match(CHAPTER_PATTERN);
    if (chapterMatch) {
      flushThought();
      chapterTitle = chapterMatch[1].trim();
      continue;
    }

    const quoteMatch = line.match(QUOTE_PATTERN);
    if (quoteMatch) {
      flushThought();
      const markText = quoteMatch[1].trim();
      if (markText) {
        notes.push({
          book,
          chapterTitle,
          item: { type: 'highlight', markText },
        });
      }
      continue;
    }

    if (line) pendingThought.push(line);
    else flushThought();
  }

  flushThought();
  return notes;
}

function sanitizeImagePlaceholders(notes: Array<NormalizedWereadNote>): SanitizedWereadNotes {
  const sanitizedNotes: Array<NormalizedWereadNote> = [];
  let placeholderCount = 0;
  let skippedImageOnlyCount = 0;

  for (const note of notes) {
    let notePlaceholderCount = 0;
    const sanitize = (value: string | undefined): string | undefined => {
      if (value === undefined) return undefined;
      const matches = value.match(IMAGE_PLACEHOLDER_PATTERN);
      notePlaceholderCount += matches?.length ?? 0;
      return value
        .replace(IMAGE_PLACEHOLDER_PATTERN, '')
        .replace(/[ \t]+\n/gu, '\n')
        .replace(/\n{3,}/gu, '\n\n')
        .trim();
    };

    const item: WereadNoteItem =
      note.item.type === 'highlight'
        ? { ...note.item, markText: sanitize(note.item.markText) }
        : {
            ...note.item,
            abstract: sanitize(note.item.abstract),
            content: sanitize(note.item.content),
          };

    placeholderCount += notePlaceholderCount;
    if (!isValidItem(item)) {
      if (notePlaceholderCount > 0) skippedImageOnlyCount++;
      continue;
    }

    sanitizedNotes.push({ ...note, item });
  }

  return {
    notes: sanitizedNotes,
    placeholderCount,
    skippedImageOnlyCount,
  };
}

function convertNote(source: NormalizedWereadNote, options: ConversionOptions): RoteNote {
  const rawContent = buildContent(source.item);
  if (!rawContent) throw new Error(importMessage('errors.emptyNote'));

  const timestamp = parseTimestamp(source.item.createTime ?? source.item.createTimeFormatted);
  const tags = normalizeTags(['微信读书', source.book.title, source.book.category], rawContent);
  const bookKey = source.book.bookId?.trim() || source.book.title.trim();
  const nativeItemId =
    source.item.type === 'highlight' ? source.item.bookmarkId : source.item.reviewId;
  const fallbackKey = [
    source.item.type,
    source.chapterUid ?? source.chapterTitle,
    source.item.createTime ?? source.item.createTimeFormatted ?? '',
    rawContent,
  ].join('\u0000');

  return {
    id: uuidv4(),
    title: [source.book.title, source.chapterTitle].filter(Boolean).join(' · '),
    type: 'Rote',
    tags,
    content: normalizeContent(rawContent, options),
    state: 'private',
    archived: false,
    authorid: 'weread',
    articleId: null,
    pin: false,
    editor: 'normal',
    createdAt: timestamp,
    updatedAt: timestamp,
    author: {
      username: 'weread',
      nickname: '微信读书',
      avatar: null,
    },
    attachments: [],
    reactions: [],
    source: createImportSource({
      provider: 'weread',
      accountKey: 'weread',
      externalKey: `${bookKey}:${nativeItemId ?? fallbackKey}`,
      sourceUpdatedAt: timestamp,
    }),
  };
}

function buildContent(item: WereadNoteItem): string {
  if (item.type === 'highlight') return item.markText?.trim() ?? '';

  const abstract = item.abstract?.trim();
  const thought = item.content?.trim();
  if (abstract && thought) return `> ${abstract.replace(/\n/g, '\n> ')}\n\n${thought}`;
  return thought ?? abstract ?? '';
}

function isValidItem(item: WereadNoteItem): boolean {
  return (
    (item.type === 'highlight' && hasText(item.markText)) ||
    (item.type === 'review' && (hasText(item.content) || hasText(item.abstract)))
  );
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeWereadText(text: string): boolean {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim());
  return (
    lines.some((line) => NOTE_COUNT_PATTERN.test(line)) &&
    lines.some((line) => CHAPTER_PATTERN.test(line) || QUOTE_PATTERN.test(line))
  );
}

function parseTimestamp(value: number | string | undefined): string {
  if (value === undefined || value === '') return new Date().toISOString();

  if (typeof value === 'number') {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim()) return parseTimestamp(numeric);

    const normalized = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
    if (!Number.isNaN(normalized.getTime())) return normalized.toISOString();
  }

  return new Date().toISOString();
}

function failedResult(error: string): ConversionResult {
  return {
    success: false,
    errors: [error],
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

function failedImageOnlyResult(total: number, placeholderCount: number): ConversionResult {
  return {
    success: false,
    errors: [importMessage('errors.wereadImageOnly')],
    warnings: [imagePlaceholderWarning(placeholderCount, total)],
    stats: {
      total,
      converted: 0,
      failed: total,
      localAttachmentsSkipped: placeholderCount,
      articlesConverted: 0,
    },
  };
}

function imagePlaceholderWarning(placeholderCount: number, skippedImageOnlyCount: number): string {
  return importMessage('warnings.wereadImages', {
    count: placeholderCount,
    skipped: skippedImageOnlyCount,
  });
}
