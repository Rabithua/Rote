import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { HonoVariables } from '../../../types/hono';

const databaseUrl = process.env.OPENKEY_NOTES_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

type NoteResponse = {
  data: {
    archived: boolean;
    content: string;
    id: string;
    pin: boolean;
    title: string | null;
    type: string | null;
  };
};

databaseDescribe('OpenKey note routes', () => {
  const userId = randomUUID();
  const openKeyId = randomUUID();
  let app: Hono<{ Variables: HonoVariables }>;
  let database: typeof import('../../../utils/drizzle').default;
  let schema: typeof import('../../../drizzle/schema');
  let operators: typeof import('drizzle-orm');
  let requestCount = 0;

  async function request(path: string, init?: RequestInit) {
    requestCount += 1;
    return app.request(`http://localhost/v2/api/openkey${path}`, init);
  }

  async function post(path: string, body: Record<string, unknown>) {
    return request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, openkey: openKeyId }),
    });
  }

  async function waitForUsageLogs() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [{ count }] = await database
        .select({ count: operators.count() })
        .from(schema.openKeyUsageLogs)
        .where(operators.eq(schema.openKeyUsageLogs.openKeyId, openKeyId));
      if (Number(count) >= requestCount) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Expected ${requestCount} OpenKey usage logs before cleanup`);
  }

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    const [{ Hono }, { default: openKeyRouter }, handlers, importedSchema, importedOperators, db] =
      await Promise.all([
        import('hono'),
        import('../openKeyRouter'),
        import('../../../utils/handlers'),
        import('../../../drizzle/schema'),
        import('drizzle-orm'),
        import('../../../utils/drizzle'),
      ]);
    schema = importedSchema;
    operators = importedOperators;
    database = db.default;
    app = new Hono<{ Variables: HonoVariables }>();
    app.route('/v2/api/openkey', openKeyRouter);
    app.onError(handlers.errorHandler);

    await database.insert(schema.users).values({
      id: userId,
      email: `openkey-routes-${userId}@example.test`,
      username: `openkey-routes-${userId}`,
    });
    await database.insert(schema.userOpenKeys).values({
      id: openKeyId,
      userid: userId,
      permissions: ['SENDROTE', 'GETROTE', 'EDITROTE', 'DELETEROTE'],
    });
  });

  afterAll(async () => {
    await waitForUsageLogs();
    await database.delete(schema.users).where(operators.eq(schema.users.id, userId));
    const { closeDatabase } = await import('../../../utils/drizzle');
    await closeDatabase();
  });

  it('creates notes through the recommended route without deprecation headers', async () => {
    const response = await post('/notes', { content: `modern-${randomUUID()}` });
    const body = (await response.json()) as NoteResponse;

    expect(response.status).toBe(201);
    expect(response.headers.get('Deprecation')).toBeNull();
    expect(response.headers.get('Link')).toBeNull();
    expect(body.data.type).toBe('rote');
    expect(body.data.pin).toBe(false);
    expect(body.data.archived).toBe(false);
  });

  it('keeps the legacy POST route and marks it as deprecated', async () => {
    const response = await post('/notes/create', {
      content: `legacy-post-${randomUUID()}`,
      pin: true,
      archived: true,
    });
    const body = (await response.json()) as NoteResponse;

    expect(response.status).toBe(201);
    expect(response.headers.get('Deprecation')).toBe('true');
    expect(response.headers.get('Link')).toBe('</v2/api/openkey/notes>; rel="successor-version"');
    expect(body.data.type).toBe('rote');
    expect(body.data.pin).toBe(true);
    expect(body.data.archived).toBe(true);
  });

  it('parses all supported legacy GET booleans without changing defaults', async () => {
    for (const [value, expected] of [
      ['true', true],
      ['1', true],
      ['false', false],
      ['0', false],
    ] as const) {
      const query = new URLSearchParams({
        openkey: openKeyId,
        content: `legacy-get-${value}-${randomUUID()}`,
        pin: value,
        archived: value,
      });
      const response = await request(`/notes/create?${query}`);
      const body = (await response.json()) as NoteResponse;

      expect(response.status).toBe(201);
      expect(response.headers.get('Deprecation')).toBe('true');
      expect(body.data.type).toBe('rote');
      expect(body.data.pin).toBe(expected);
      expect(body.data.archived).toBe(expected);
    }
  });

  it('rejects unsupported legacy GET booleans', async () => {
    const query = new URLSearchParams({
      openkey: openKeyId,
      content: `invalid-boolean-${randomUUID()}`,
      pin: 'yes',
    });
    const response = await request(`/notes/create?${query}`);
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe('Invalid pin parameter: expected true, false, 1, or 0');
  });

  it('updates and deletes notes through the shared application service', async () => {
    const createdResponse = await post('/notes', { content: `write-flow-${randomUUID()}` });
    const created = (await createdResponse.json()) as NoteResponse;
    const updateResponse = await request(`/notes/${created.data.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ openkey: openKeyId, title: 'updated through OpenKey' }),
    });
    const updated = (await updateResponse.json()) as NoteResponse;
    const deleteResponse = await request(`/notes/${created.data.id}?openkey=${openKeyId}`, {
      method: 'DELETE',
    });

    expect(createdResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(updated.data.title).toBe('updated through OpenKey');
    expect(deleteResponse.status).toBe(200);
  });
});
