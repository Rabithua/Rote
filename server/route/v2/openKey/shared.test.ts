import { describe, expect, it } from 'bun:test';
import { parseLegacyBoolean, parseOptionalInteger, processTags } from './shared';

describe('OpenKey route input parsing', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    [undefined, undefined],
  ] as const)('parses legacy boolean %s', (value, expected) => {
    expect(parseLegacyBoolean(value, 'pin')).toBe(expected);
  });

  it('rejects unsupported legacy boolean values', () => {
    expect(() => parseLegacyBoolean('yes', 'pin')).toThrow('invalid_boolean_parameter:pin');
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
