import removeMarkdown from 'remove-markdown';

import type { ConversionOptions } from './types';

export function normalizeContent(content: string, options: ConversionOptions): string {
  if (!options.cleanMarkdown) return content;

  return removeMarkdown(content, {
    stripListLeaders: true,
    listUnicodeChar: '',
    gfm: true,
    useImgAltText: true,
  }).trim();
}

export function normalizeTags(tags: unknown, content: string): Array<string> {
  const explicitTags = Array.isArray(tags) ? tags.flatMap((tag) => normalizeTagValue(tag)) : [];
  const contentTags = extractTagsFromContent(content);
  const uniqueTags = new Set([...explicitTags, ...contentTags]);

  return [...uniqueTags].slice(0, 20);
}

function normalizeTagValue(tag: unknown): Array<string> {
  if (typeof tag === 'string') {
    const normalized = normalizeTagName(tag);
    return normalized ? [normalized] : [];
  }

  if (tag && typeof tag === 'object') {
    const tagRecord = tag as Record<string, unknown>;
    const value = tagRecord.name ?? tagRecord.tag ?? tagRecord.value;
    return normalizeTagValue(value);
  }

  return [];
}

function normalizeTagName(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/, '')
    .replace(/[，,.;:!?。！？、]+$/u, '')
    .trim()
    .slice(0, 50);
}

function extractTagsFromContent(content: string): Array<string> {
  const tags = new Set<string>();
  const tagPattern = /(?:^|\s)#([^\s#]+)/gu;

  for (const match of content.matchAll(tagPattern)) {
    const normalized = normalizeTagName(match[1]);
    if (normalized) {
      tags.add(normalized);
    }
  }

  return [...tags];
}
