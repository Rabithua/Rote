import { describe, expect, it } from 'bun:test';
import { errorHandler } from './handlers';
import type { HonoContext } from '../types/hono';

// Drizzle's DrizzleQueryError keeps the PostgreSQL error on `cause`; this is the
// shape that previously fell through unique-violation handling as a bare 500.
class DrizzleQueryError extends Error {
  readonly query: string;
  readonly cause: unknown;
  constructor(query: string, cause: unknown) {
    super(`Failed query: ${query}`);
    this.name = 'DrizzleQueryError';
    this.query = query;
    this.cause = cause;
  }
}

class PostgresError extends Error {
  readonly code: string;
  readonly constraint_name: string;
  constructor(code: string, message: string, constraintName?: string) {
    super(message);
    this.name = 'PostgresError';
    this.code = code;
    this.constraint_name = constraintName ?? '';
  }
}

function createContext() {
  const jsonCalls: Array<{ payload: unknown; status: number }> = [];
  const c = {
    json: (payload: unknown, status?: number) => {
      jsonCalls.push({ payload, status: status ?? 200 });
      return new Response(null, { status: status ?? 200 });
    },
  } as unknown as HonoContext;
  return { c, jsonCalls };
}

describe('errorHandler', () => {
  it('maps unique violations wrapped by drizzle to a 409', async () => {
    const error = new DrizzleQueryError(
      'insert into "users" ("email", "username", "nickname") values ($1, $2, $3)',
      new PostgresError(
        '23505',
        'duplicate key value violates unique constraint',
        'users_username_unique'
      )
    );
    const { c, jsonCalls } = createContext();
    await errorHandler(error, c);
    expect(jsonCalls[0].status).toBe(409);
    // The sniffed message stays generic because a users insert mentions both
    // email and username columns; the fixed part is the 409 mapping itself.
    expect(jsonCalls[0].payload).toMatchObject({ message: 'Username or email already exists' });
  });

  it('maps connection failures wrapped by drizzle to a database error response', async () => {
    const error = new DrizzleQueryError(
      'select 1',
      new PostgresError('08006', 'the connection is closed')
    );
    const { c, jsonCalls } = createContext();
    await errorHandler(error, c);
    expect(jsonCalls[0].status).toBe(500);
    expect(jsonCalls[0].payload).toMatchObject({
      message: 'Database connection error. Please contact administrator.',
    });
  });

  it('maps wrapped not-null violations to the database error response', async () => {
    const error = new DrizzleQueryError(
      'insert into "users" ("email", "username") values ($1, $2)',
      new PostgresError('23502', 'null value in column "email" violates not-null constraint')
    );
    const { c, jsonCalls } = createContext();
    await errorHandler(error, c);
    expect(jsonCalls[0].status).toBe(500);
    expect(jsonCalls[0].payload).toMatchObject({
      message: 'Database error occurred. Please contact administrator.',
    });
  });

  it('still handles direct postgres errors without a wrapper', async () => {
    const error = new PostgresError('23505', 'duplicate key', 'users_username_unique');
    const { c, jsonCalls } = createContext();
    await errorHandler(error, c);
    expect(jsonCalls[0].status).toBe(409);
  });

  it('keeps non-database errors on the generic 500 branch', async () => {
    const error = new Error('Something unrelated went wrong');
    const { c, jsonCalls } = createContext();
    await errorHandler(error, c);
    expect(jsonCalls[0].status).toBe(500);
    expect(jsonCalls[0].payload).toMatchObject({ message: 'Something unrelated went wrong' });
  });

  it('does not treat non-SQLSTATE codes as database errors', async () => {
    const error = new DrizzleQueryError(
      'select 1',
      Object.assign(new Error('token expired'), { code: 'ERR_JWT_EXPIRED' })
    );
    const { c, jsonCalls } = createContext();
    await errorHandler(error, c);
    expect(jsonCalls[0].status).toBe(500);
    // The wrapper message contains SQL keywords, so it stays sanitized.
    expect(jsonCalls[0].payload).toMatchObject({ message: 'Internal server error' });
  });
});
