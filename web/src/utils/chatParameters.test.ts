import { describe, expect, it } from 'vitest';
import { buildChatParameters } from './chatParameters';
import { DEFAULT_PERSONAL_AI_SETTINGS, withPersonalAiDefaults } from '@/state/localAi';

describe('browser default thinking', () => {
  it('uses high and enables supported model thinking without settings controls', () => {
    expect(
      buildChatParameters(
        { model: 'glm-5.3-flash', baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4' },
        0.2
      )
    ).toEqual({
      temperature: 0.2,
      reasoning_effort: 'high',
      thinking: { type: 'enabled' },
    });
    expect(buildChatParameters({ model: 'gpt-4.1-mini' }, 0.2)).toEqual({ temperature: 0.2 });
    expect(buildChatParameters({ model: 'custom-model' }, 0.2)).toEqual({ temperature: 0.2 });
  });

  it.each([null, 'low', 'medium'])(
    'normalizes saved effort %s to high without losing keys',
    (effort) => {
      const legacy = {
        ...DEFAULT_PERSONAL_AI_SETTINGS.personal,
        apiKey: 'saved',
        reasoningEffort: effort as 'high',
      };
      const settings = withPersonalAiDefaults({ mode: 'personal', personal: legacy });
      expect(settings.personal.reasoningEffort).toBe('high');
      expect(settings.personal.apiKey).toBe('saved');
    }
  );
});
