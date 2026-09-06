import { expect, it } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import drizzleConfig from '../drizzle.config';

it('generates no duplicate SQL from the checked-in migration snapshots', async () => {
  const server = resolve(import.meta.dir, '..');
  const folder = mkdtempSync(join(tmpdir(), 'rote-schema-diff-'));
  try {
    const migrations = join(folder, 'migrations');
    cpSync(join(server, 'drizzle/migrations'), migrations, { recursive: true });
    const config = join(folder, 'drizzle.config.ts');
    writeFileSync(
      config,
      `export default ${JSON.stringify({
        ...drizzleConfig,
        out: relative(server, migrations),
        dbCredentials: undefined,
      })}`
    );
    const before = readdirSync(migrations).sort();
    const journal = readFileSync(join(migrations, 'meta/_journal.json'), 'utf8');
    const process = Bun.spawn(['bun', 'run', 'db:generate', '--config', config], {
      cwd: server,
      env: { ...globalThis.process.env, POSTGRESQL_URL: '' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    expect({ exitCode, stderr: exitCode ? stderr : '' }).toEqual({ exitCode: 0, stderr: '' });
    expect(stdout + stderr).toContain('No schema changes');
    expect(readdirSync(migrations).sort()).toEqual(before);
    expect(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8')).toBe(journal);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}, 30_000);
