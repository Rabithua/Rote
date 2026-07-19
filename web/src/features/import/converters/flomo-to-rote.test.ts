import { describe, expect, it } from 'vitest';

import { convertFlomoToRote, isFlomoSourceData } from './flomo-to-rote';

describe('flomo converter', () => {
  it('converts content, tags, remote attachments, and skips local attachments', () => {
    const result = convertFlomoToRote({
      html: flomoHtml(`
        <div class="memo">
          <div class="time">2024-01-02 12:34:56</div>
          <div class="content"><p>Hello #tag</p><ul><li>List item</li></ul></div>
          <div class="files">
            <img src="https://example.com/image.png" />
            <audio src="./local.mp3"></audio>
          </div>
        </div>
      `),
    });

    expect(result.success).toBe(true);
    expect(result.stats.localAttachmentsSkipped).toBe(1);
    expect(result.data?.notes[0]).toMatchObject({
      content: 'Hello #tag\n- List item',
      tags: ['tag'],
      author: { username: 'alice' },
      source: { provider: 'flomo' },
    });
    expect(result.data?.notes[0].attachments[0].url).toBe('https://example.com/image.png');
  });

  it('validates flomo exports and rejects empty documents', () => {
    expect(isFlomoSourceData({ html: flomoHtml('<div class="memo"></div>') })).toBe(true);
    expect(isFlomoSourceData({ html: '<html></html>' })).toBe(false);
    expect(convertFlomoToRote({ html: flomoHtml('') }).success).toBe(false);
  });

  it('creates repeatable but distinct identities for identical-time notes', () => {
    const memo = `
      <div class="memo">
        <div class="time">2024-01-02 12:34:56</div>
        <div class="content">same</div>
      </div>`;
    const input = { html: flomoHtml(`${memo}${memo}`) };

    const first = convertFlomoToRote(input);
    const second = convertFlomoToRote(input);
    const firstSources = first.data?.notes.map((note) => note.source);

    expect(firstSources).toEqual(second.data?.notes.map((note) => note.source));
    expect(firstSources?.[0].externalId).not.toBe(firstSources?.[1].externalId);
  });
});

function flomoHtml(content: string) {
  return `<html><head><title>flomo</title></head><body>
    <header><div class="top"><div class="user"><div class="name">@alice</div></div></div></header>
    ${content}
  </body></html>`;
}
