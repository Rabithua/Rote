import { describe, expect, it } from 'bun:test';

process.env.POSTGRESQL_URL ||= 'postgres://rote:rote_password_123@localhost:5433/rote';

const { default: reactionsRouter } = await import('../route/v2/reaction');

describe('anonymous reaction route policy', () => {
  it('rejects a custom anonymous reaction before accessing the note', async () => {
    const response = await reactionsRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'custom reaction',
        roteid: '10000000-0000-4000-8000-000000000001',
        visitorId: 'anonymous-reaction-route-test',
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 403,
      message: 'anonymous_reaction_not_allowed',
      data: null,
    });
  });

  it('treats an invalid access token as anonymous for reaction admission', async () => {
    const response = await reactionsRouter.request('/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: '👎',
        roteid: '10000000-0000-4000-8000-000000000001',
        visitorId: 'anonymous-reaction-invalid-token-test',
      }),
    });

    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe('anonymous_reaction_not_allowed');
  });
});
