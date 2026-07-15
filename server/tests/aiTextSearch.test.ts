import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sanitizeExcludeIds } from '../utils/dbMethods/ai/sourceIds';
import { buildSourceIdExclusionSql } from '../utils/dbMethods/ai/textSearchSql';

const dialect = new PgDialect();
const roteId = '4c67fd19-1961-4942-a2ef-f61e203be40f';
const articleId = '2aecb5c7-7b92-4d1c-bf85-2becd86b5a06';

describe('textSearchMemory exclusion queries', () => {
  test.each([
    { sourceType: 'rote' as const, sourceId: roteId, alias: 'r' },
    { sourceType: 'article' as const, sourceId: articleId, alias: 'a' },
  ])('casts $sourceType exclusions to uuid[]', ({ sourceId, alias }) => {
    const query = dialect.sqlToQuery(buildSourceIdExclusionSql(alias, [sourceId]));

    expect(query.sql).toContain(`${alias}."id" = ANY(`);
    expect(query.sql).toContain('::uuid[]');
    expect(query.sql).not.toContain('::text[]');
    expect(query.params).toContain(sourceId);
  });

  test('omits the exclusion clause when no IDs have been seen', () => {
    const query = dialect.sqlToQuery(buildSourceIdExclusionSql('r', []));

    expect(query.sql).toBe('');
    expect(query.params).toEqual([]);
  });

  test('ignores malformed UUIDs before constructing the database cast', () => {
    const query = dialect.sqlToQuery(buildSourceIdExclusionSql('r', ['not-a-uuid', roteId]));

    expect(query.sql).toContain('::uuid[]');
    expect(query.params).toEqual([roteId]);
  });
});

describe('sanitizeExcludeIds', () => {
  test('keeps UUID source keys and drops malformed client state', () => {
    expect(
      sanitizeExcludeIds([
        `rote:${roteId}`,
        `rote:${roteId}`,
        'rote:not-a-uuid',
        `article:${articleId}`,
        'unknown:4c67fd19-1961-4942-a2ef-f61e203be40f',
        42,
      ])
    ).toEqual([`rote:${roteId}`, `article:${articleId}`]);
  });

  test('rejects non-array and fully invalid input', () => {
    expect(sanitizeExcludeIds(`rote:${roteId}`)).toBeUndefined();
    expect(sanitizeExcludeIds(['rote:not-a-uuid'])).toBeUndefined();
  });
});
