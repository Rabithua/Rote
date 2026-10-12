import { ConversationConflict, type ConversationApi } from './api';
import { completeLegacyImport, legacyImportAvailable, prepareLegacyImport } from './legacyImport';
import { reconcileConversation, sameSnapshot, snapshotOf } from './reconciliation';
import { emptyConversationCache, readConversationCache, writeConversationCache } from './storage';
import type {
  Conversation,
  ConversationCache,
  ConversationIssue,
  ConversationScope,
  ConversationSnapshot,
  ConversationView,
} from './types';

/** Owns account-scoped cache, durable write intent and one serialized worker per conversation. */
export class AiConversationSync {
  private scope: ConversationScope | null = null;
  private cache: ConversationCache = emptyConversationCache();
  private controller = new AbortController();
  private workers = new Map<string, Promise<void>>();
  private protectedRuns = new Set<string>();
  private loading = false;
  private loaded = false;
  private issue?: ConversationIssue;
  private storage: Storage;
  private api: ConversationApi;
  private changed: (view: ConversationView) => void;
  private scopeCurrent: (scope: ConversationScope) => boolean;

  constructor(
    storage: Storage,
    api: ConversationApi,
    changed: (view: ConversationView) => void,
    scopeCurrent: (scope: ConversationScope) => boolean = () => true
  ) {
    this.storage = storage;
    this.api = api;
    this.changed = changed;
    this.scopeCurrent = scopeCurrent;
  }

  get isActiveScope() {
    return Boolean(this.scope && this.current(this.scope, this.controller));
  }
  get canImportLegacy() {
    return this.loaded && this.isActiveScope;
  }

  get view(): ConversationView {
    let hasLegacy = false;
    if (this.scope && !this.cache.imported) {
      try {
        hasLegacy = legacyImportAvailable(this.storage, this.scope);
      } catch {
        this.issue = 'storage';
      }
    }
    return {
      hasLegacy,
      canImportLegacy: hasLegacy && this.canImportLegacy,
      scopeKey: this.scope?.key || null,
      conversations: Object.values(this.cache.conversations)
        .filter((conversation) => !conversation.deletedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)),
      selectedId: this.cache.selectedId,
      isLoading: this.loading,
      issue: Object.values(this.cache.pending).some((intent) => intent.conflict)
        ? 'conflict'
        : this.issue,
      hasPending: Object.keys(this.cache.pending).length > 0,
      canKeepCopy: Boolean(
        this.cache.selectedId &&
        this.cache.pending[this.cache.selectedId]?.conflict &&
        !this.cache.pending[this.cache.selectedId]?.conflict?.deletedAt
      ),
    };
  }

  get selected() {
    return this.cache.selectedId ? this.cache.conversations[this.cache.selectedId] : undefined;
  }
  conversation(id: string) {
    return this.cache.conversations[id];
  }
  protectRun(id: string) {
    this.protectedRuns.add(id);
  }
  releaseRun(id: string) {
    this.protectedRuns.delete(id);
  }

  private current(scope: ConversationScope, controller: AbortController) {
    return (
      this.scope?.key === scope.key &&
      this.controller === controller &&
      !controller.signal.aborted &&
      this.scopeCurrent(scope)
    );
  }

  private publish() {
    if (this.selected?.deletedAt) this.cache.selectedId = this.view.conversations[0]?.id || null;
    if (this.scope) {
      try {
        writeConversationCache(this.storage, this.scope, this.cache);
      } catch {
        this.issue = 'storage';
      }
    }
    this.changed(this.view);
  }

  async activate(scope: ConversationScope | null, interrupted: string) {
    this.controller.abort();
    this.controller = new AbortController();
    this.workers = new Map();
    this.protectedRuns = new Set();
    this.scope = scope;
    this.cache = emptyConversationCache();
    this.loaded = false;
    this.loading = Boolean(scope);
    this.issue = undefined;
    if (scope) {
      try {
        this.cache = readConversationCache(this.storage, scope);
      } catch {
        this.issue = 'storage';
      }
    }
    this.changed(this.view);
    if (scope) await this.refresh(interrupted);
  }

  async refresh(_interrupted: string) {
    const scope = this.scope;
    const controller = this.controller;
    if (!scope || !this.current(scope, controller)) return;
    this.loading = true;
    this.changed(this.view);
    try {
      const remote: Conversation[] = [];
      let cursor: string | null = null;
      do {
        const page = await this.api.list(scope, cursor, controller.signal);
        if (!this.current(scope, controller)) return;
        remote.push(...page.conversations);
        cursor = page.nextCursor;
      } while (cursor);
      remote.forEach((conversation) => {
        reconcileConversation(this.cache, conversation, this.protectedRuns.has(conversation.id));
        if (
          !this.cache.pending[conversation.id] &&
          completeLegacyImport(this.storage, scope, conversation.id)
        )
          this.cache.imported = true;
      });
      this.loaded = true;
      this.issue = undefined;
      if (!this.selected || this.selected.deletedAt) {
        this.cache.selectedId = this.view.conversations[0]?.id || null;
      }
    } catch {
      if (this.current(scope, controller)) this.issue = 'load';
    } finally {
      if (this.current(scope, controller)) {
        this.loading = false;
        this.publish();
      }
    }
    if (this.current(scope, controller) && this.loaded) {
      await Promise.all(Object.keys(this.cache.pending).map((id) => this.flush(id)));
    }
  }

  importLegacy(interrupted: string) {
    if (!this.scope || !this.loaded || !this.isActiveScope) return;
    try {
      const legacy = prepareLegacyImport(this.storage, this.scope, interrupted);
      if (!legacy) return;
      const existing = this.cache.conversations[legacy.id];
      if (existing?.deletedAt) {
        this.issue = 'conflict';
        this.publish();
        return;
      }
      if (
        existing &&
        !this.cache.pending[legacy.id] &&
        sameSnapshot(snapshotOf(existing), snapshotOf(legacy))
      ) {
        this.cache.imported = true;
        completeLegacyImport(this.storage, this.scope, legacy.id);
        this.publish();
        return;
      }
      if (!existing) this.cache.conversations[legacy.id] = legacy;
      if (!this.cache.pending[legacy.id])
        this.cache.pending[legacy.id] = { snapshot: snapshotOf(legacy), delete: false };
      this.cache.selectedId = legacy.id;
      this.publish();
      void this.flush(legacy.id);
    } catch {
      this.issue = 'storage';
      this.publish();
    }
  }

  select(id: string) {
    if (!this.cache.conversations[id] || this.cache.conversations[id].deletedAt) return;
    this.cache.selectedId = id;
    this.publish();
  }

  create() {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.cache.conversations[id] = {
      id,
      revision: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      messages: [],
    };
    this.cache.selectedId = id;
    this.publish();
    return id;
  }

  save(id: string, snapshot: ConversationSnapshot) {
    const local = this.cache.conversations[id];
    if (!local || this.cache.pending[id]?.delete) return;
    if (local.deletedAt) {
      if (local.revision !== null && snapshot.messages.length) {
        this.cache.pending[id] = {
          snapshot,
          delete: false,
          conflict: { ...local, revision: local.revision },
        };
        this.publish();
      }
      return;
    }
    this.cache.conversations[id] = { ...local, ...snapshot, updatedAt: new Date().toISOString() };
    this.cache.pending[id] = {
      snapshot,
      delete: false,
      conflict: this.cache.pending[id]?.conflict,
    };
    this.publish();
    void this.flush(id);
  }

  delete(id: string) {
    const local = this.cache.conversations[id];
    if (!local || local.deletedAt) return;
    const pending = this.cache.pending[id];
    if (local.revision === null && !pending && !this.workers.has(id)) {
      delete this.cache.conversations[id];
    } else {
      this.cache.pending[id] = { snapshot: pending?.snapshot || snapshotOf(local), delete: true };
      this.cache.conversations[id] = {
        ...local,
        deletedAt: new Date().toISOString(),
        messages: [],
      };
    }
    if (this.cache.selectedId === id)
      this.cache.selectedId = this.view.conversations[0]?.id || null;
    this.publish();
    void this.flush(id);
  }

  keepConflictCopy() {
    const id = this.cache.selectedId;
    const pending = id ? this.cache.pending[id] : undefined;
    if (!id || !pending?.conflict || pending.conflict.deletedAt) return;
    const snapshot = pending.snapshot;
    this.cache.conversations[id] = pending.conflict;
    delete this.cache.pending[id];
    const copyId = this.create();
    this.save(copyId, { ...snapshot, createdAt: new Date().toISOString() });
  }

  flush(id: string): Promise<void> {
    const existing = this.workers.get(id);
    if (existing) return existing;
    const scope = this.scope;
    const controller = this.controller;
    if (!scope || !this.loaded || !this.current(scope, controller)) return Promise.resolve();
    const work = this.sendPending(id, scope, controller).finally(() => {
      if (this.current(scope, controller)) {
        this.workers.delete(id);
        if (this.cache.pending[id] && !this.cache.pending[id].conflict && !this.issue)
          void this.flush(id);
      }
    });
    this.workers.set(id, work);
    return work;
  }

  private async sendPending(id: string, scope: ConversationScope, controller: AbortController) {
    let retriedDeletion = false;
    while (this.current(scope, controller)) {
      const intent = this.cache.pending[id];
      const local = this.cache.conversations[id];
      if (!intent || intent.conflict || !local) return;
      const sentSnapshot = intent.snapshot;
      const revision = local.revision;
      try {
        const remote =
          intent.delete && revision !== null
            ? await this.api.delete(scope, id, revision, controller.signal)
            : await this.api.put(scope, id, sentSnapshot, revision, controller.signal);
        if (!this.current(scope, controller)) return;
        const latest = this.cache.pending[id];
        const known = this.cache.conversations[id];
        const knownRevision = Math.max(known?.revision || 0, latest?.conflict?.revision || 0);
        if (
          remote.revision < knownRevision ||
          (known?.deletedAt && !latest?.delete && !remote.deletedAt)
        )
          return;
        if (remote.deletedAt) {
          this.cache.conversations[id] = remote;
          delete this.cache.pending[id];
        } else {
          this.cache.conversations[id].revision = remote.revision;
          if (latest && !latest.delete && sameSnapshot(latest.snapshot, sentSnapshot)) {
            this.cache.conversations[id] = remote;
            delete this.cache.pending[id];
          }
          if (completeLegacyImport(this.storage, scope, id)) this.cache.imported = true;
        }
        this.issue = undefined;
        this.publish();
      } catch (error) {
        if (!this.current(scope, controller)) return;
        if (error instanceof ConversationConflict) {
          if (!this.cache.pending[id]) return;
          const remote = error.conversation;
          const newest = Math.max(
            this.cache.conversations[id]?.revision || 0,
            this.cache.pending[id]?.conflict?.revision || 0
          );
          if (
            remote.revision < newest ||
            (this.cache.conversations[id]?.deletedAt &&
              !this.cache.pending[id]?.delete &&
              !remote.deletedAt)
          )
            return;
          if (this.cache.pending[id]?.delete && !remote.deletedAt) {
            this.cache.conversations[id].revision = remote.revision;
            if (!retriedDeletion) {
              retriedDeletion = true;
              this.publish();
              continue;
            }
            this.issue = 'save';
            this.publish();
            return;
          }
          if (
            !remote.deletedAt &&
            sameSnapshot(this.cache.pending[id].snapshot, snapshotOf(remote))
          ) {
            this.cache.conversations[id] = remote;
            delete this.cache.pending[id];
            if (completeLegacyImport(this.storage, scope, id)) this.cache.imported = true;
            this.issue = undefined;
            this.publish();
            return;
          }
          if (remote.deletedAt) {
            this.cache.conversations[id] = remote;
            if (this.cache.pending[id]?.delete) delete this.cache.pending[id];
            else this.cache.pending[id].conflict = remote;
          } else {
            this.cache.pending[id].conflict = remote;
          }
        } else this.issue = 'save';
        this.publish();
        return;
      }
    }
  }
}
