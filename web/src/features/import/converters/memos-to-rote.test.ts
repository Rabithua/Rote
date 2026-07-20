import { describe, expect, it } from 'vitest';

import { convertMemosToRote } from './memos-to-rote';
import type { MemoSourceData, SQLiteSourceData } from './types';

const baseMemo: MemoSourceData['memos'][number] = {
  name: 'memos/test123',
  state: 'NORMAL',
  creator: 'users/1',
  createTime: '2024-01-01T00:00:00Z',
  updateTime: '2024-01-02T00:00:00Z',
  displayTime: '2024-01-01T00:00:00Z',
  content: '# Test\nBody #inline',
  visibility: 'PUBLIC',
  tags: ['explicit'],
  pinned: false,
  attachments: [],
  relations: [],
  reactions: [],
  snippet: 'Test Body',
};

describe('Memos converter', () => {
  it('converts API data, normalizes tags, and defaults visibility to private', () => {
    const result = convertMemosToRote({
      memos: [baseMemo],
      nextPageToken: '',
      sourceAccount: 'https://memos.example.com',
    });

    expect(result.success).toBe(true);
    expect(result.data?.formatVersion).toBe(2);
    expect(result.data?.notes[0]).toMatchObject({
      content: '# Test\nBody #inline',
      tags: ['explicit', 'inline'],
      state: 'private',
      source: { provider: 'memos' },
    });
  });

  it('preserves public visibility only when explicitly requested', () => {
    const result = convertMemosToRote({ memos: [baseMemo], nextPageToken: '' }, undefined, {
      preserveVisibility: true,
    });

    expect(result.data?.notes[0].state).toBe('public');
  });

  it('uses stable source identities across fresh conversions', () => {
    const input = {
      memos: [baseMemo],
      nextPageToken: '',
      sourceAccount: 'https://memos.example.com',
    };

    const first = convertMemosToRote(input);
    const second = convertMemosToRote(input);

    expect(first.data?.notes[0].source).toEqual(second.data?.notes[0].source);
    expect(first.data?.notes[0].id).not.toBe(second.data?.notes[0].id);
  });

  it('keeps protected API images for an explicit preview placeholder', () => {
    const result = convertMemosToRote({
      memos: [
        {
          ...baseMemo,
          attachments: [
            {
              name: 'attachments/image-id',
              filename: 'photo one.png',
              type: 'image/png',
              size: '123',
              externalLink: '',
            },
          ],
        },
      ],
      nextPageToken: '',
      sourceAccount: 'https://memos.example.com',
    });

    expect(result.data?.notes[0].attachments[0]).toMatchObject({
      url: 'https://memos.example.com/file/attachments/image-id/photo%20one.png',
      details: { previewRequiresAuthorization: true },
    });
  });

  it('uses display time and does not flatten comments into unrelated notes', () => {
    const comment = {
      ...baseMemo,
      name: 'memos/comment-1',
      content: 'A comment',
    };
    const parent = {
      ...baseMemo,
      displayTime: '2023-12-01T00:00:00Z',
      relations: [
        {
          memo: { name: comment.name },
          relatedMemo: { name: baseMemo.name },
          type: 'COMMENT',
        },
      ],
      reactions: [{ reactionType: '👍' }],
      location: { placeholder: 'redacted' },
    };

    const result = convertMemosToRote({ memos: [parent, comment], nextPageToken: '' });

    expect(result.data?.notes).toHaveLength(1);
    expect(result.data?.notes[0].createdAt).toBe('2023-12-01T00:00:00Z');
    expect(result.warnings).toHaveLength(3);
  });

  it('reports unsupported API attachments instead of silently dropping them', () => {
    const result = convertMemosToRote({
      memos: [
        {
          ...baseMemo,
          attachments: [
            {
              name: 'attachments/audio-id',
              filename: 'voice.webm',
              type: 'audio/webm',
              externalLink: 'https://cdn.example/voice.webm',
            },
          ],
        },
      ],
      nextPageToken: '',
    });

    expect(result.data?.notes[0].attachments).toEqual([]);
    expect(result.stats.localAttachmentsSkipped).toBe(1);
    expect(result.warnings).toHaveLength(1);
  });

  it('filters SQLite notes by the selected user', () => {
    const data: SQLiteSourceData = {
      users: [createUser(1, 'alice'), createUser(2, 'bob')],
      memos: [createSQLiteMemo(1, 1, 'alice note'), createSQLiteMemo(2, 2, 'bob note')],
      attachments: [],
    };

    const result = convertMemosToRote(data, 2);

    expect(result.stats.total).toBe(1);
    expect(result.data?.notes).toHaveLength(1);
    expect(result.data?.notes[0]).toMatchObject({
      content: 'bob note',
      author: { username: 'bob' },
    });
  });
});

function createUser(id: number, username: string) {
  return {
    id,
    created_ts: 1_700_000_000,
    updated_ts: 1_700_000_000,
    row_status: 'NORMAL',
    username,
    role: 'USER',
    email: '',
    nickname: username,
    avatar_url: '',
    description: '',
  };
}

function createSQLiteMemo(id: number, creatorId: number, content: string) {
  return {
    id,
    uid: `memo-${id}`,
    creator_id: creatorId,
    created_ts: 1_700_000_000,
    updated_ts: 1_700_000_100,
    row_status: 'NORMAL',
    content,
    visibility: 'PRIVATE',
    pinned: false,
    payload: {},
  };
}
