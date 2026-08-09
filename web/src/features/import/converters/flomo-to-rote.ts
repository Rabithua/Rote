import { v4 as uuidv4 } from 'uuid';

import { createAttachmentSource, createImportSource, dedupeNotesBySource } from './import-source';
import { normalizeContent, normalizeTags } from './shared';
import { importMessage } from '../messages';
import type {
  ConversionOptions,
  ConversionResult,
  FlomoSourceData,
  RoteAttachment,
  RoteNote,
} from './types';

export function convertFlomoToRote(
  data: FlomoSourceData,
  _selectedUserId?: number,
  options: ConversionOptions = {}
): ConversionResult {
  if (!isFlomoSourceData(data)) {
    return createFailedResult(importMessage('errors.invalidFlomo'));
  }

  const document = parseHtml(data.html);
  const memoElements = Array.from(document.querySelectorAll('.memo'));

  if (memoElements.length === 0) {
    return createFailedResult(importMessage('errors.noFlomoMemos'));
  }

  const author = extractAuthor(document);
  const notes: Array<RoteNote> = [];
  const errors: Array<string> = [];
  const warnings: Array<string> = [];
  let localAttachmentsSkipped = 0;
  const signatureOccurrences = new Map<string, number>();

  memoElements.forEach((memoElement, index) => {
    try {
      const contentElement = memoElement.querySelector('.content');
      const filesElement = memoElement.querySelector('.files');
      const rawTime = memoElement.querySelector('.time')?.textContent ?? '';
      const timestamp = parseFlomoTime(rawTime);
      const rawContent = contentElement ? extractContentText(contentElement) : '';
      const signature = `${rawTime.trim()}\u0000${rawContent}`;
      const occurrence = signatureOccurrences.get(signature) ?? 0;
      signatureOccurrences.set(signature, occurrence + 1);
      const noteSource = createImportSource({
        provider: 'flomo',
        accountKey: author.username,
        externalKey: `${signature}\u0000${occurrence}`,
        sourceUpdatedAt: timestamp,
      });
      const content = normalizeContent(rawContent, options);
      const { attachments, skippedCount } = convertFlomoAttachments(filesElement, noteSource);

      localAttachmentsSkipped += skippedCount;

      notes.push({
        id: uuidv4(),
        title: '',
        type: 'Rote',
        tags: normalizeTags([], rawContent),
        content,
        state: 'private',
        archived: false,
        authorid: author.id,
        articleId: null,
        pin: false,
        editor: 'normal',
        createdAt: timestamp,
        updatedAt: timestamp,
        author: {
          username: author.username,
          nickname: author.nickname,
          avatar: null,
        },
        attachments,
        reactions: [],
        source: noteSource,
      });
    } catch (error) {
      errors.push(
        importMessage('errors.flomoConvert', {
          index: index + 1,
          error: (error as Error).message,
        })
      );
    }
  });

  if (localAttachmentsSkipped > 0) {
    warnings.push(
      importMessage('warnings.flomoLocalAttachments', {
        count: localAttachmentsSkipped,
      })
    );
  }

  warnings.push(importMessage('warnings.flomoIdentity'));

  const uniqueNotes = dedupeNotesBySource(notes);

  return {
    success: errors.length === 0,
    data: { formatVersion: 2, articles: [], notes: uniqueNotes },
    errors,
    warnings,
    stats: {
      total: memoElements.length,
      converted: uniqueNotes.length,
      failed: errors.length,
      localAttachmentsSkipped,
      articlesConverted: 0,
    },
  };
}

export function isFlomoSourceData(data: unknown): data is FlomoSourceData {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as FlomoSourceData).html === 'string' &&
    (data as FlomoSourceData).html.includes('flomo') &&
    (data as FlomoSourceData).html.includes('class="memo"')
  );
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function extractAuthor(document: Document) {
  const nameElement = document.querySelector('header .top .user .name');
  const rawName = nameElement ? nameElement.textContent.trim() : 'flomo';
  const username = rawName.replace(/^@/, '') || 'flomo';

  return {
    id: username,
    username,
    nickname: rawName,
  };
}

function parseFlomoTime(rawTime: string): string {
  const trimmed = rawTime.trim();
  const normalized = trimmed ? new Date(`${trimmed.replace(' ', 'T')}+08:00`) : new Date();

  if (Number.isNaN(normalized.getTime())) {
    return new Date().toISOString();
  }

  return normalized.toISOString();
}

function extractContentText(contentElement: Element): string {
  const lines: Array<string> = [];

  Array.from(contentElement.childNodes).forEach((node) => {
    collectBlockText(node, lines);
  });

  return compactBlankLines(lines).join('\n').trim();
}

function collectBlockText(node: Node, lines: Array<string>) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeInlineText(node.textContent ?? '');
    if (text) lines.push(text);
    return;
  }

  if (!(node instanceof Element)) return;

  const tagName = node.tagName.toLowerCase();

  if (tagName === 'br') {
    return;
  }

  if (tagName === 'p') {
    lines.push(normalizeInlineText(extractInlineText(node)));
    return;
  }

  if (tagName === 'ul' || tagName === 'ol') {
    Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .forEach((li) => {
        const marker = tagName === 'ol' ? '1. ' : '- ';
        lines.push(`${marker}${normalizeInlineText(extractInlineText(li))}`);
      });
    return;
  }

  if (tagName === 'li') {
    lines.push(`- ${normalizeInlineText(extractInlineText(node))}`);
    return;
  }

  Array.from(node.childNodes).forEach((child) => {
    collectBlockText(child, lines);
  });
}

function extractInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (!(node instanceof Element)) return '';

  const tagName = node.tagName.toLowerCase();

  if (tagName === 'br') return '\n';
  if (tagName === 'img') {
    return node.getAttribute('alt') ?? '';
  }

  return Array.from(node.childNodes).map(extractInlineText).join('');
}

function normalizeInlineText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function compactBlankLines(lines: Array<string>): Array<string> {
  const compacted: Array<string> = [];

  lines.forEach((line) => {
    const isBlank = !line.trim();
    const previousBlank = compacted.length > 0 && !compacted[compacted.length - 1].trim();

    if (isBlank && previousBlank) return;
    compacted.push(line);
  });

  return compacted;
}

function convertFlomoAttachments(
  filesElement: Element | null,
  noteSource: RoteNote['source']
): {
  attachments: Array<RoteAttachment>;
  skippedCount: number;
} {
  if (!filesElement) {
    return { attachments: [], skippedCount: 0 };
  }

  const mediaElements = Array.from(
    filesElement.querySelectorAll('img[src], audio[src], video[src], a[href]')
  );
  let skippedCount = 0;

  const attachments = mediaElements.flatMap((element, index) => {
    const url = element.getAttribute('src') ?? element.getAttribute('href') ?? '';
    if (!isRemoteUrl(url)) {
      skippedCount++;
      return [];
    }

    return [createAttachment(url, element, index, noteSource)];
  });

  return { attachments, skippedCount };
}

function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function createAttachment(
  url: string,
  element: Element,
  sortIndex: number,
  noteSource: RoteNote['source']
): RoteAttachment {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    url,
    compressUrl: url,
    userid: '',
    roteid: '',
    storage: 'REMOTE',
    details: {
      key: extractFilename(url),
      size: 0,
      mtime: now,
      mimetype: inferMimeType(url, element),
      compressKey: '',
    },
    createdAt: now,
    updatedAt: now,
    sortIndex,
    source: createAttachmentSource(noteSource, `${sortIndex}:${url}`),
  };
}

function extractFilename(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return url.split('/').filter(Boolean).pop() ?? '';
  }
}

function inferMimeType(url: string, element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase();

  if (tagName === 'audio') return `audio/${extension || 'mpeg'}`;
  if (tagName === 'video') return `video/${extension || 'mp4'}`;
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';

  return 'application/octet-stream';
}

function createFailedResult(message: string): ConversionResult {
  return {
    success: false,
    errors: [message],
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
