import { describe, expect, it } from 'bun:test';
import { InvalidCustomMetaTags, normalizeCustomMetaTags } from './customMetaTags';

describe('custom site metadata', () => {
  it('serializes metadata in order, preserving repeat tags and escaping attributes', () => {
    const metadata = normalizeCustomMetaTags(
      `<meta content='A &amp; B "quoted" <!--#include virtual="/private" -->' name="twitter:creator" />
       <meta property=og:image content=https://example.test/first.jpg>
       <meta property=og:image content=https://example.test/second.jpg>
       <meta name="empty" content="">`
    );
    expect(metadata).toBe(
      '<meta name="twitter:creator" content="A &amp; B &quot;quoted&quot; &lt;!--#include virtual=&quot;/private&quot; --&gt;">\n' +
        '<meta property="og:image" content="https://example.test/first.jpg">\n' +
        '<meta property="og:image" content="https://example.test/second.jpg">\n' +
        '<meta name="empty" content="">'
    );
    expect(normalizeCustomMetaTags(metadata)).toBe(metadata);
  });

  it('rejects active markup, reserved metadata, and oversized input', () => {
    for (const value of [
      null,
      ['<meta name="test" content="value">'],
      '<script>alert(1)</script>',
      '<meta http-equiv="refresh" content="0; URL=/">',
      '<meta charset="utf-8">',
      '<meta name="test" content="value" onload="alert(1)">',
      '<meta name="test" name="duplicate" content="value">',
      '<meta name="test" property="og:test" content="value">',
      '<meta name="test">',
      '<meta name=" " content="value">',
      '<meta property=" Robots " content="index">',
      '<meta name="description" content="duplicate">',
      '<meta name="rote-revision" content="false-revision">',
      '<html><meta name="test" content="value"></html>',
      `<meta name="test" content="${'汉'.repeat(3000)}">`,
    ]) {
      expect(() => normalizeCustomMetaTags(value)).toThrow(InvalidCustomMetaTags);
    }
  });
});
