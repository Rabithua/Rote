import { assert, assertStatus, request } from './common.test';

export async function testLegacyRestNoteTypeCompatibility(appAccessToken: string) {
  const headers = { Authorization: 'Bearer ' + appAccessToken };
  const create = await request('POST', '/notes', {
    headers,
    body: {
      content: 'Legacy REST note type compatibility',
      type: 'legacy-custom-type',
    },
  });
  assertStatus(create.status, 201, 'legacy REST note create');

  const note = create.data.data;
  assert(note?.id, 'legacy REST note id missing');
  assert(
    !Object.prototype.hasOwnProperty.call(note, 'type'),
    'legacy REST note response must omit type'
  );

  try {
    const update = await request('PUT', '/notes/' + note.id, {
      headers,
      body: { title: 'Updated through legacy JSON', type: 'legacy-custom-type' },
    });
    assertStatus(update.status, 200, 'legacy REST note update');
    assert(
      !Object.prototype.hasOwnProperty.call(update.data.data, 'type'),
      'legacy REST update response must omit type'
    );

    const list = await request('GET', '/notes?limit=100&type=legacy-custom-type', { headers });
    assertStatus(list.status, 200, 'legacy REST note type filter');
    assert(
      list.data.data.some((candidate: Record<string, unknown>) => candidate.id === note.id),
      'legacy REST type query must not filter out notes'
    );
    assert(
      list.data.data.every(
        (candidate: Record<string, unknown>) =>
          !Object.prototype.hasOwnProperty.call(candidate, 'type')
      ),
      'legacy REST list responses must omit type'
    );
  } finally {
    const cleanup = await request('DELETE', '/notes/' + note.id, { headers });
    assertStatus(cleanup.status, 200, 'legacy REST note cleanup');
  }
}
