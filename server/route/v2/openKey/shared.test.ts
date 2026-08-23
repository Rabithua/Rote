import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import {
  markConvenienceNoteCreate,
  markLegacyNoteCreatePost,
  parseBooleanQueryParameter,
  parseOptionalInteger,
  processTags,
} from './shared';

describe('OpenKey route input parsing', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    [undefined, undefined],
  ] as const)('parses query boolean %s', (value, expected) => {
    expect(parseBooleanQueryParameter(value, 'pin')).toBe(expected);
  });

  it('rejects unsupported query boolean values', () => {
    expect(() => parseBooleanQueryParameter('yes', 'pin')).toThrow('invalid_boolean_parameter:pin');
  });

  it('only accepts whole pagination numbers at or above the minimum', () => {
    expect(parseOptionalInteger('12', 'invalid', 0)).toBe(12);
    expect(parseOptionalInteger(undefined, 'invalid', 0)).toBeUndefined();
    expect(() => parseOptionalInteger('1.5', 'invalid', 0)).toThrow('invalid');
    expect(() => parseOptionalInteger('-1', 'invalid', 0)).toThrow('invalid');
  });

  it('normalizes and validates tags', () => {
    expect(processTags([' first ', '', 'second'])).toEqual(['first', 'second']);
    expect(() => processTags(Array.from({ length: 21 }, (_, index) => `tag-${index}`))).toThrow(
      'Maximum 20 tags allowed'
    );
  });
});

describe('OpenKey note creation route policy', () => {
  it('marks the convenience GET response as non-cacheable and supported', async () => {
    const app = new Hono();
    app.get('/', (c) => {
      markConvenienceNoteCreate(c);
      return c.text('ok');
    });

    const response = await app.request('/');

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Deprecation')).toBeNull();
    expect(response.headers.get('Link')).toBeNull();
  });

  it('marks only the legacy POST response as deprecated', async () => {
    const app = new Hono();
    app.post('/', (c) => {
      markLegacyNoteCreatePost(c);
      return c.text('ok');
    });

    const response = await app.request('/', { method: 'POST' });

    expect(response.headers.get('Deprecation')).toBe('true');
    expect(response.headers.get('Link')).toBe('</v2/api/openkey/notes>; rel="successor-version"');
  });
});
