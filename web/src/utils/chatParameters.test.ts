import { describe, expect, it } from 'vitest';
import { buildChatParameters } from './chatParameters';
import { DEFAULT_PERSONAL_AI_SETTINGS, withPersonalAiDefaults } from '@/state/localAi';

describe('browser chat parameters', () => {
  it('uses high by default only for recognized reasoning models', () => {
    expect(buildChatParameters({ model: 'glm-5.3-flash' }, 0.2).reasoning_effort).toBe('high');
    expect(buildChatParameters({ model: 'gpt-4.1-mini' }, 0.2)).toEqual({ temperature: 0.2 });
    expect(buildChatParameters({ model: 'custom-model' }, 0.2)).toEqual({ temperature: 0.2 });
  });

  it('migrates saved settings to high without losing keys or overriding opt-out', () => {
    const { reasoningEffort: _effort, ...legacy } = DEFAULT_PERSONAL_AI_SETTINGS.personal;
    const settings = withPersonalAiDefaults({
      mode: 'personal',
      personal: { ...legacy, apiKey: 'saved' },
    });
    expect(settings.personal.reasoningEffort).toBe('high');
    expect(settings.personal.apiKey).toBe('saved');
    expect(
      withPersonalAiDefaults({
        ...settings,
        personal: { ...settings.personal, reasoningEffort: null },
      }).personal.reasoningEffort
    ).toBeNull();
  });
});
