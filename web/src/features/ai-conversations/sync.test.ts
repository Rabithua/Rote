import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConversationSync } from './sync';
import { ConversationConflict, type ConversationApi } from './api';
import { cacheKey, conversationScope, readConversationCache } from './storage';
import { sameSnapshot, snapshotOf } from './reconciliation';
import type { Conversation, ConversationScope, ConversationSnapshot } from './types';

const scope = conversationScope('https://rote.example/v2/api/', 'user-a');
const date = '2026-10-11T04:00:00.000Z';
const snapshot = (content: string): ConversationSnapshot => ({
  createdAt: date,
  messages: [{ id: 'message', role: 'user', content, createdAt: date }],
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function fakeApi() {
  const rows = new Map<string, Conversation>();
  const key = (owner: ConversationScope, id: string) => `${owner.key}:${id}`;
  const api: ConversationApi = {
    list: vi.fn(async (owner) => ({
      conversations: [...rows.entries()]
        .filter(([id]) => id.startsWith(`${owner.key}:`))
        .map(([, value]) => structuredClone(value)),
      nextCursor: null,
    })),
    put: vi.fn(async (owner, id, next, revision) => {
      const old = rows.get(key(owner, id));
      if (
        old &&
        (old.deletedAt ||
          revision === null ||
          (old.revision !== revision && !sameSnapshot(snapshotOf(old), next)))
      )
        throw new ConversationConflict(structuredClone(old));
      const row: Conversation = {
        ...structuredClone(next),
        id,
        revision: (old?.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      rows.set(key(owner, id), row);
      return structuredClone(row);
    }),
    delete: vi.fn(async (owner, id, revision) => {
      const old = rows.get(key(owner, id))!;
      if (!old.deletedAt && old.revision !== revision)
        throw new ConversationConflict(structuredClone(old));
      const row = {
        ...old,
        revision: old.revision + 1,
        deletedAt: date,
        messages: [],
        agentConversationId: undefined,
      };
      rows.set(key(owner, id), row);
      return structuredClone(row);
    }),
  };
  return { api, rows, key };
}

beforeEach(() => localStorage.clear());

describe('account-scoped durable conversation synchronization', () => {
  it('serializes an in-flight start create and final save with the acknowledged revision', async () => {
    const { api } = fakeApi();
    const gate = deferred<Conversation>();
    const backend = fakeApi();
    api.put = vi.fn(async (...args: Parameters<ConversationApi['put']>) => {
      const result = await backend.api.put(...args);
      if (args[3] === null) await gate.promise;
      return result;
    });
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('start'));
    sync.save(id, snapshot('final'));
    gate.resolve({} as Conversation);
    await sync.flush(id);
    expect(vi.mocked(api.put).mock.calls.map((call) => call[3])).toEqual([null, 1]);
    expect(sync.selected?.messages[0].content).toBe('final');
    expect(sync.view.hasPending).toBe(false);
  });

  it('journals deletion before an in-flight create returns and deletes the acknowledged row', async () => {
    const { api, rows, key } = fakeApi();
    const gate = deferred<Conversation>();
    const put = api.put;
    api.put = vi.fn(async (...args: Parameters<ConversationApi['put']>) => {
      const result = await put(...args);
      await gate.promise;
      return result;
    });
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('question'));
    sync.delete(id);
    expect(readConversationCache(localStorage, scope).pending[id].delete).toBe(true);
    gate.resolve({} as Conversation);
    await sync.flush(id);
    expect(api.delete).toHaveBeenCalledWith(scope, id, 1, expect.any(AbortSignal));
    expect(rows.get(key(scope, id))?.deletedAt).toBeTruthy();
    expect(sync.view.conversations).toHaveLength(0);
    expect(sync.view.hasPending).toBe(false);
  });

  it('retains failed content and pending journal across reload then retries', async () => {
    const { api } = fakeApi();
    vi.mocked(api.put).mockRejectedValueOnce(new Error('offline'));
    const first = new AiConversationSync(localStorage, api, () => {});
    await first.activate(scope, 'interrupted');
    const id = first.create();
    first.save(id, snapshot('offline question'));
    await first.flush(id);
    expect(first.view.issue).toBe('save');
    expect(
      readConversationCache(localStorage, scope).pending[id].snapshot.messages[0].content
    ).toBe('offline question');
    const second = new AiConversationSync(localStorage, api, () => {});
    await second.activate(scope, 'interrupted');
    expect(second.selected?.messages[0].content).toBe('offline question');
    expect(second.view.hasPending).toBe(false);
  });

  it('keeps revision conflicts locally and only creates a branch on an explicit copy action', async () => {
    const { api, rows, key } = fakeApi();
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('first'));
    await sync.flush(id);
    rows.set(key(scope, id), {
      ...rows.get(key(scope, id))!,
      ...snapshot('other device'),
      revision: 2,
    });
    sync.save(id, snapshot('my unsynced response'));
    await sync.flush(id);
    expect(sync.view.issue).toBe('conflict');
    expect(sync.selected?.messages[0].content).toBe('my unsynced response');
    expect(rows.size).toBe(1);
    sync.keepConflictCopy();
    await sync.flush(sync.selected!.id);
    expect(rows.size).toBe(2);
    expect(sync.selected?.messages[0].content).toBe('my unsynced response');
  });

  it('does not revive a remotely deleted dirty conversation or automatically copy its messages', async () => {
    const { api, rows, key } = fakeApi();
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('first'));
    await sync.flush(id);
    rows.set(key(scope, id), {
      ...rows.get(key(scope, id))!,
      revision: 2,
      deletedAt: date,
      messages: [],
    });
    sync.save(id, snapshot('unsynced'));
    await sync.flush(id);
    sync.keepConflictCopy();
    expect(sync.view.conversations).toHaveLength(0);
    expect(sync.view.canKeepCopy).toBe(false);
    expect(rows.size).toBe(1);
    expect(
      readConversationCache(localStorage, scope).pending[id].snapshot.messages[0].content
    ).toBe('unsynced');
  });

  it('rejects old site/account responses while keeping their pending cache', async () => {
    const { api } = fakeApi();
    const gate = deferred<Conversation>();
    const put = api.put;
    api.put = vi.fn(async (...args: Parameters<ConversationApi['put']>) => {
      const response = await put(...args);
      await gate.promise;
      return response;
    });
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('account A'));
    const oldWrite = sync.flush(id);
    const nextScope = conversationScope('https://another.example/v2/api', 'user-b');
    await sync.activate(nextScope, 'interrupted');
    gate.resolve({} as Conversation);
    await oldWrite;
    expect(sync.view.scopeKey).toBe(nextScope.key);
    expect(sync.view.conversations).toHaveLength(0);
    expect(readConversationCache(localStorage, scope).pending[id]).toBeDefined();
    expect(localStorage.getItem(cacheKey(nextScope))).not.toContain('account A');
  });

  it.each([false, true])(
    'ignores a held older list after a save/delete acknowledgement (deleted %s)',
    async (deleted) => {
      const { api } = fakeApi();
      const sync = new AiConversationSync(localStorage, api, () => {});
      await sync.activate(scope, 'interrupted');
      const id = sync.create();
      sync.save(id, snapshot('first'));
      await sync.flush(id);
      const old = structuredClone(sync.selected!) as Conversation;
      const gate = deferred<{ conversations: Conversation[]; nextCursor: null }>();
      vi.mocked(api.list).mockImplementationOnce(() => gate.promise);
      const refresh = sync.refresh('interrupted');
      if (deleted) sync.delete(id);
      else sync.save(id, snapshot('second'));
      await sync.flush(id);
      gate.resolve({ conversations: [old], nextCursor: null });
      await refresh;
      if (deleted) expect(sync.view.conversations).toHaveLength(0);
      else {
        expect(sync.selected?.revision).toBe(2);
        expect(sync.selected?.messages[0].content).toBe('second');
      }
    }
  );

  it.each([false, true])(
    'does not let a held PUT acknowledgement erase a newer remote conflict (tombstone %s)',
    async (deleted) => {
      const { api, rows, key } = fakeApi();
      const sync = new AiConversationSync(localStorage, api, () => {});
      await sync.activate(scope, 'interrupted');
      const id = sync.create();
      sync.save(id, snapshot('first'));
      await sync.flush(id);
      const gate = deferred<Conversation>();
      const put = api.put;
      api.put = vi.fn(async (...args: Parameters<ConversationApi['put']>) => {
        const result = await put(...args);
        await gate.promise;
        return result;
      });
      sync.save(id, snapshot('my response'));
      await Promise.resolve();
      rows.set(key(scope, id), {
        ...rows.get(key(scope, id))!,
        ...snapshot('newer remote'),
        revision: 3,
        deletedAt: deleted ? date : null,
        ...(deleted ? { messages: [] } : {}),
      });
      const refresh = sync.refresh('interrupted');
      await vi.waitFor(() => expect(sync.view.issue).toBe('conflict'));
      gate.resolve({} as Conversation);
      await sync.flush(id);
      await refresh;
      const cache = readConversationCache(localStorage, scope);
      expect(cache.pending[id].conflict?.revision).toBe(3);
      expect(cache.pending[id].snapshot.messages[0].content).toBe('my response');
      if (deleted) expect(sync.view.conversations).toHaveLength(0);
    }
  );

  it('does not import global legacy history until clicked and claims it once for an account/site', async () => {
    localStorage.setItem(
      'aiChatMessages',
      JSON.stringify([{ id: '1791691200000-old', role: 'user', content: 'legacy' }])
    );
    const { api } = fakeApi();
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    expect(api.put).not.toHaveBeenCalled();
    expect(sync.view.hasLegacy).toBe(true);
    sync.importLegacy('interrupted');
    const id = sync.selected!.id;
    await sync.flush(id);
    expect(sync.selected?.createdAt).toBe(date);
    expect(localStorage.getItem('aiChatMessages')).toBeNull();
    await sync.activate(scope, 'interrupted');
    expect(api.put).toHaveBeenCalledTimes(1);
    localStorage.setItem(
      'aiChatMessages',
      JSON.stringify([{ id: 'old', role: 'user', content: 'another legacy snapshot' }])
    );
    await sync.activate(conversationScope(scope.site, 'user-b'), 'interrupted');
    sync.importLegacy('interrupted');
    expect(sync.view.hasLegacy).toBe(false);
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('recovers lost create acknowledgement then honors a deletion even when final content differs', async () => {
    const { api, rows, key } = fakeApi();
    const original = api.put;
    api.put = vi.fn(async (...args: Parameters<ConversationApi['put']>) => {
      await original(...args);
      throw new Error('lost acknowledgement');
    });
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('start'));
    await sync.flush(id);
    sync.save(id, snapshot('final'));
    await sync.flush(id);
    api.put = original;
    sync.delete(id);
    await sync.flush(id);
    expect(rows.get(key(scope, id))?.deletedAt).toBeTruthy();
    expect(sync.view.hasPending).toBe(false);
  });

  it('follows an authorized deletion through DELETE revision conflict', async () => {
    const { api, rows, key } = fakeApi();
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('first'));
    await sync.flush(id);
    rows.set(key(scope, id), {
      ...rows.get(key(scope, id))!,
      revision: 2,
      ...snapshot('another device'),
    });
    sync.delete(id);
    await sync.flush(id);
    expect(vi.mocked(api.delete).mock.calls.map((call) => call[2])).toEqual([1, 2]);
    expect(rows.get(key(scope, id))?.deletedAt).toBeTruthy();
  });

  it('does not let a delayed older 409 overwrite a newer tombstone conflict', async () => {
    const { api, rows, key } = fakeApi();
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('first'));
    await sync.flush(id);
    const older = { ...rows.get(key(scope, id))!, revision: 2, ...snapshot('remote second') };
    const gate = deferred<Conversation>();
    api.put = vi.fn(async () => {
      await gate.promise;
      throw new ConversationConflict(older);
    });
    sync.save(id, snapshot('unsynced response'));
    rows.set(key(scope, id), { ...older, revision: 3, deletedAt: date, messages: [] });
    const refresh = sync.refresh('interrupted');
    await vi.waitFor(() => expect(sync.view.issue).toBe('conflict'));
    gate.resolve(older);
    await sync.flush(id);
    await refresh;
    const cache = readConversationCache(localStorage, scope);
    expect(cache.conversations[id].revision).toBe(3);
    expect(cache.pending[id].conflict?.revision).toBe(3);
    expect(cache.pending[id].conflict?.deletedAt).toBeTruthy();
  });

  it('ignores a held create 409 after a matching list already acknowledged the snapshot', async () => {
    const { api } = fakeApi();
    const put = api.put;
    const gate = deferred<Conversation>();
    api.put = vi.fn(async (...args: Parameters<ConversationApi['put']>) => {
      const row = await put(...args);
      await gate.promise;
      throw new ConversationConflict(row);
    });
    const sync = new AiConversationSync(localStorage, api, () => {});
    await sync.activate(scope, 'interrupted');
    const id = sync.create();
    sync.save(id, snapshot('matching create'));
    await sync.refresh('interrupted');
    expect(sync.view.hasPending).toBe(false);
    gate.resolve({} as Conversation);
    await sync.flush(id);
    expect(sync.selected?.revision).toBe(1);
    expect(sync.view.issue).toBeUndefined();
  });

  it('keeps legacy data after a lost acknowledgement and adopts matching remote data on reload', async () => {
    const raw = JSON.stringify([{ id: '1791691200000-old', role: 'user', content: 'legacy' }]);
    localStorage.setItem('aiChatMessages', raw);
    const { api } = fakeApi();
    const put = api.put;
    api.put = vi.fn(async (...args: Parameters<ConversationApi['put']>) => {
      await put(...args);
      throw new Error('lost acknowledgement');
    });
    const first = new AiConversationSync(localStorage, api, () => {});
    await first.activate(scope, 'interrupted');
    first.importLegacy('interrupted');
    const id = first.selected!.id;
    await first.flush(id);
    expect(localStorage.getItem('aiChatMessages')).toBe(raw);
    expect(readConversationCache(localStorage, scope).imported).not.toBe(true);
    api.put = put;
    const second = new AiConversationSync(localStorage, api, () => {});
    await second.activate(scope, 'interrupted');
    expect(second.selected?.id).toBe(id);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('aiChatMessages')).toBeNull();
    expect(readConversationCache(localStorage, scope).imported).toBe(true);
  });

  it('loads every remote page before flushing pending writes and keeps cached entries omitted by moving pagination', async () => {
    const { api } = fakeApi();
    const first = new AiConversationSync(localStorage, api, () => {});
    await first.activate(scope, 'interrupted');
    const id = first.create();
    first.save(id, snapshot('cached'));
    await first.flush(id);
    const secondPage = deferred<{ conversations: Conversation[]; nextCursor: null }>();
    vi.mocked(api.list).mockImplementation(async (_scope, cursor) =>
      cursor ? secondPage.promise : { conversations: [], nextCursor: 'page-2' }
    );
    const second = new AiConversationSync(localStorage, api, () => {});
    const loading = second.activate(scope, 'interrupted');
    await Promise.resolve();
    second.save(id, snapshot('dirty while loading'));
    expect(api.put).toHaveBeenCalledTimes(1);
    secondPage.resolve({ conversations: [], nextCursor: null });
    await loading;
    expect(second.selected?.messages[0].content).toBe('dirty while loading');
    expect(api.put).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(api.put).mock.calls.length;
    second.select(id);
    expect(api.put).toHaveBeenCalledTimes(calls);
  });
});
