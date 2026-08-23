import { assert, assertStatus, registerClient, request, type Json } from './common.test';
import { authorizeAndExchange, callTool, mcp } from './flow.test';

export async function testProtocol(accessToken: string) {
  const noToken = await request('POST', '/mcp', {
    body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
  });
  assertStatus(noToken.status, 401, 'MCP no token');
  const getWithoutSse = await request('GET', '/mcp', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  assertStatus(getWithoutSse.status, 405, 'MCP GET no SSE');
  const notification = await request('POST', '/mcp', {
    headers: { Authorization: 'Bearer ' + accessToken },
    body: { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
  });
  assertStatus(notification.status, 202, 'MCP notification');
  const initialize = await mcp(accessToken, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'oauth-mcp-test', version: '1.0.0' },
  });
  assertStatus(initialize.status, 200, 'MCP initialize');
  assert(initialize.data.result?.protocolVersion === '2025-06-18', 'initialize protocol mismatch');
  assertStatus((await mcp(accessToken, 'ping')).status, 200, 'MCP ping');
  const tools = await mcp(accessToken, 'tools/list');
  assertStatus(tools.status, 200, 'MCP tools/list');
  const names = tools.data.result?.tools?.map((tool: Json) => tool.name) || [];
  for (const expected of [
    'notes_create',
    'articles_create',
    'reactions_add',
    'profile_get',
    'statistics_get',
    'attachments_presign_upload',
  ]) {
    assert(names.includes(expected), 'tools/list missing ' + expected);
  }
  for (const tool of tools.data.result?.tools || []) {
    if (['notes_create', 'notes_list', 'notes_search', 'notes_update'].includes(tool.name)) {
      assert(
        !Object.prototype.hasOwnProperty.call(tool.inputSchema?.properties || {}, 'type'),
        tool.name + ' must not advertise the retired note type'
      );
    }
  }
}

export async function testMcpTools(accessToken: string) {
  const article = await callTool(accessToken, 'articles_create', {
    content: 'OAuth MCP test article',
  });
  assert(article.id, 'article id missing');
  const note = await callTool(accessToken, 'notes_create', {
    title: 'OAuth MCP test note',
    content: 'OAuth MCP test note content',
    state: 'private',
    tags: ['oauth-mcp'],
    articleId: article.id,
    type: 'legacy-custom-type',
  });
  assert(note.id, 'note id missing');
  assert(!Object.prototype.hasOwnProperty.call(note, 'type'), 'legacy note type should be ignored');
  await callTool(accessToken, 'notes_list', { limit: 10, type: 'legacy-custom-type' });
  await callTool(accessToken, 'notes_search', {
    keyword: 'OAuth MCP',
    limit: 10,
    type: 'legacy-custom-type',
  });
  await callTool(accessToken, 'notes_get', { id: note.id });
  await callTool(accessToken, 'notes_batch_get', { ids: [note.id] });
  await callTool(accessToken, 'notes_update', {
    id: note.id,
    title: 'OAuth MCP test note updated',
    content: 'OAuth MCP test note content updated',
    tags: ['oauth-mcp', 'updated'],
    articleId: article.id,
    type: 'legacy-custom-type',
  });
  await callTool(accessToken, 'articles_list', { limit: 10 });
  await callTool(accessToken, 'articles_get', { id: article.id });
  await callTool(accessToken, 'articles_get_by_note', { noteId: note.id });
  await callTool(accessToken, 'articles_update', {
    id: article.id,
    content: 'OAuth MCP test article updated',
  });
  await callTool(accessToken, 'reactions_add', {
    type: 'like',
    roteid: note.id,
    metadata: { source: 'oauth-mcp-test' },
  });
  await callTool(accessToken, 'reactions_remove', { type: 'like', roteid: note.id });
  const profile = await callTool(accessToken, 'profile_get');
  await callTool(accessToken, 'profile_update', {
    nickname: profile.nickname || 'MCP Test User',
    description: profile.description || 'MCP OAuth smoke test user',
  });
  await callTool(accessToken, 'permissions_get');
  await callTool(accessToken, 'tags_get');
  await callTool(accessToken, 'heatmap_get', { startDate: '2026-01-01', endDate: '2026-12-31' });
  await callTool(accessToken, 'statistics_get');
  const settings = await callTool(accessToken, 'settings_get');
  await callTool(accessToken, 'settings_update', { allowExplore: settings.allowExplore });
  await callTool(
    accessToken,
    'attachments_presign_upload',
    { files: [{ filename: 'mcp-test.jpg', contentType: 'image/jpeg', size: 1024 }] },
    false
  );
  await callTool(
    accessToken,
    'attachments_finalize_upload',
    {
      noteId: note.id,
      attachments: [
        {
          uuid: crypto.randomUUID(),
          originalKey: 'users/not-the-current-user/uploads/mcp-test.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
        },
      ],
    },
    false
  );
  await callTool(
    accessToken,
    'attachments_sort',
    { noteId: note.id, attachmentIds: [crypto.randomUUID()] },
    false
  );
  await callTool(accessToken, 'attachments_delete_one', { id: crypto.randomUUID() }, false);
  await callTool(accessToken, 'attachments_delete_many', { ids: [crypto.randomUUID()] }, false);
  await callTool(accessToken, 'notes_delete', { id: note.id });
  await callTool(accessToken, 'articles_delete', { id: article.id });
}

export async function testInsufficientScope(appAccessToken: string) {
  const client = await registerClient(['notes:read']);
  const token = await authorizeAndExchange({
    appAccessToken,
    clientId: client.client_id,
    scopes: ['notes:read'],
  });
  const tools = await mcp(token.accessToken, 'tools/list');
  assertStatus(tools.status, 200, 'limited scope tools/list');
  const names = tools.data.result?.tools?.map((tool: Json) => tool.name) || [];
  assert(names.includes('notes_list'), 'limited scope should include notes_list');
  assert(!names.includes('notes_create'), 'limited scope must not include notes_create');
  const denied = await mcp(token.accessToken, 'tools/call', {
    name: 'notes_create',
    arguments: { content: 'should not be created' },
  });
  assertStatus(denied.status, 403, 'insufficient scope tool call');
}
