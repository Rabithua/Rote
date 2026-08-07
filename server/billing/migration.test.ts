import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(import.meta.dir, '../drizzle/migrations/0022_billing_foundation.sql'),
  'utf8'
);

describe('billing foundation migration', () => {
  it('creates grant and inbound delivery tables with ordering and replay constraints', () => {
    expect(migration).toContain('CREATE TABLE "billing_grants"');
    expect(migration).toContain('"revision" bigint NOT NULL');
    expect(migration).toContain('"snapshot_hash" varchar(64) NOT NULL');
    expect(migration).toContain('CREATE TABLE "billing_inbound_deliveries"');
    expect(migration).toContain('PRIMARY KEY("direction","delivery_id")');
    expect(migration).toContain('ON DELETE cascade');
  });
});
