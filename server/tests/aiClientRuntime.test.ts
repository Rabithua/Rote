import { describe, expect, it } from 'bun:test';
import type { AiConfig } from '../types/config';
import { executeClientRoteTool } from '../utils/ai/agent/clientRuntime';

const config: AiConfig = {
  schemaVersion: 2,
  revision: 0,
  enabled: true,
  vectorEnabled: true,
  autoIndexEnabled: false,
  publicExploreVectorEnabled: false,
  chat: { providerId: 'local', baseUrl: 'http://local', model: 'local' },
  embedding: {
    providerId: 'test',
    baseUrl: 'http://test',
    model: 'test',
    output: { mode: 'dimensions', output: { mode: 'dimensions', dimensions: 3 } },
  },
  indexing: { chunkSize: 800, chunkOverlap: 100, batchSize: 1, maxRetries: 1 },
};

describe('client agent tool runtime', () => {
  it('rejects tools outside the server whitelist', async () => {
    await expect(
      executeClientRoteTool({
        userId: 'user',
        config,
        toolName: 'dangerous_unknown_tool',
        arguments: {},
        request: { message: 'hello' },
        state: {},
        sourceKeys: [],
      })
    ).rejects.toThrow('Unknown Rote AI tool');
  });

  it('executes a stateless built-in tool and preserves source numbering state', async () => {
    const existingSourceKey = 'rote:00000000-0000-4000-8000-000000000001';
    const result = await executeClientRoteTool({
      userId: 'user',
      config,
      toolName: 'rote_skill_view',
      arguments: {},
      request: { message: 'help me review notes' },
      state: { stateVersion: 1, seenSourceIds: [] },
      sourceKeys: [existingSourceKey],
      sourceCharsUsed: 200,
    });

    expect(result.modelContent).toContain('"skill"');
    expect(result.sourceKeys).toEqual([existingSourceKey]);
    expect(result.sourceCharsUsed).toBe(200);
    expect(result.state.stateVersion).toBe(1);
  });
  it('restores more than 20 references and read progress, then resets both for a new answer', async () => {
    const keys = Array.from(
      { length: 40 },
      (_, i) => `rote:00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    );
    const resumed = await executeClientRoteTool({
      userId: 'user',
      config,
      toolName: 'rote_skill_view',
      arguments: {},
      request: { message: 'help' },
      state: {},
      sourceKeys: keys,
      sourceCharsUsed: 7000,
      readOffsets: { [keys[0]]: 2000 },
    });
    expect(resumed.sourceKeys).toEqual(keys);
    expect(resumed.sourceCharsUsed).toBe(7000);
    expect(resumed.readOffsets).toEqual({ [keys[0]]: 2000 });
    const fresh = await executeClientRoteTool({
      userId: 'user',
      config,
      toolName: 'rote_skill_view',
      arguments: {},
      request: { message: 'help' },
      state: {},
      sourceKeys: [],
    });
    expect(fresh.sourceKeys).toEqual([]);
    expect(fresh.readOffsets).toEqual({});
    expect(fresh.sourceCharsUsed).toBe(0);
  });
});
