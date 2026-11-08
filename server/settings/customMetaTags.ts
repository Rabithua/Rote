import { parseFragment } from 'parse5';

const maxBytes = 8 * 1024;
const htmlWhitespace = /^[\t\n\f\r ]*$/;
const protectedIdentifiers = new Set([
  'description',
  'robots',
  'referrer',
  'viewport',
  'theme-color',
  'apple-mobile-web-app-capable',
  'mobile-web-app-capable',
  'apple-mobile-web-app-status-bar-style',
  'rote-revision',
]);
const attributeEscapes: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
  '\n': '&#10;',
};

export class InvalidCustomMetaTags extends Error {
  constructor() {
    super('invalid_custom_meta_tags');
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>\n]/g, (character) => attributeEscapes[character]);
}

export function normalizeCustomMetaTags(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const encoder = new TextEncoder();
  if (typeof value !== 'string' || encoder.encode(value).byteLength > maxBytes) {
    throw new InvalidCustomMetaTags();
  }

  const fragment = parseFragment(value, {
    sourceCodeLocationInfo: true,
    onParseError: () => {
      throw new InvalidCustomMetaTags();
    },
  });

  const tags: string[] = [];
  let end = 0;
  for (const node of fragment.childNodes) {
    if (node.nodeName === '#text' && 'value' in node && htmlWhitespace.test(node.value)) continue;
    const location = node.sourceCodeLocation;
    // The parser may discard invalid elements instead of returning them as nodes.
    if (
      !location ||
      !htmlWhitespace.test(value.slice(end, location.startOffset)) ||
      !('tagName' in node) ||
      node.tagName !== 'meta' ||
      node.attrs.length !== 2
    ) {
      throw new InvalidCustomMetaTags();
    }

    const identifier = node.attrs.find(({ name }) => name === 'name' || name === 'property');
    const content = node.attrs.find(({ name }) => name === 'content')?.value;
    const key = identifier?.value.trim().toLowerCase();
    if (!identifier || !key || protectedIdentifiers.has(key) || content === undefined) {
      throw new InvalidCustomMetaTags();
    }

    end = location.endOffset;
    tags.push(
      `<meta ${identifier.name}="${escapeAttribute(identifier.value)}" content="${escapeAttribute(content)}">`
    );
  }

  const html = tags.join('\n');
  if (!htmlWhitespace.test(value.slice(end)) || encoder.encode(html).byteLength > maxBytes) {
    throw new InvalidCustomMetaTags();
  }
  return html || undefined;
}
