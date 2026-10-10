import { describe, expect, it } from 'bun:test';
import { buildChatParameters } from '../utils/ai/chatParameters';
import { buildChatParameters as buildBrowserChatParameters } from '../../web/src/utils/chatParameters';
import { buildChatRequestBody } from '../utils/ai/clientShared';
import { DEFAULT_AI_CONFIG, mergeAiConfig, resolveIncomingAiConfig } from '../utils/ai/providers';

describe('chat parameter compatibility', () => {
  it.each([
    'glm-5.2',
    'glm-5.3',
    'z-ai/glm-5.3-flash',
    'glm-4.7',
    'deepseek-flash',
    'deepseek-v4-pro',
    'deepseek-reasoner',
    'gpt-5.2',
    'openai/gpt-5-pro',
    'gpt-5-chat-latest',
    'o1',
    'o1-mini',
    'o1-preview',
    'o3-mini',
    'gpt-4.1-mini',
    'gemma-4-12b-it',
    'custom-model',
  ])('keeps independent browser/server clients consistent for %s', (model) => {
    for (const reasoningEffort of [undefined, null, 'low', 'medium', 'high'] as const) {
      const config = { model, reasoningEffort };
      expect(buildChatParameters(config, 0.2)).toEqual(buildBrowserChatParameters(config, 0.2));
    }
  });
  it('defaults new and existing chat settings to high and preserves opt-out', () => {
    expect(DEFAULT_AI_CONFIG.chat.reasoningEffort).toBe('high');
    const { reasoningEffort: _effort, ...legacyChat } = DEFAULT_AI_CONFIG.chat;
    expect(mergeAiConfig({ chat: legacyChat }).chat.reasoningEffort).toBe('high');
    expect(
      resolveIncomingAiConfig({ chat: { ...legacyChat, reasoningEffort: null } }).chat
        .reasoningEffort
    ).toBeNull();
    expect(DEFAULT_AI_CONFIG.embedding).not.toHaveProperty('reasoningEffort');
  });

  it.each(['glm-5.3', 'glm-5.3-flash', 'z-ai/glm-5.3-flash'])('%s defaults to high', (model) => {
    expect(buildChatParameters({ model }, 0.2)).toEqual({
      temperature: 0.2,
      reasoning_effort: 'high',
    });
  });

  it('converts model-specific effort levels', () => {
    expect(
      buildChatParameters({ model: 'glm-5.3', reasoningEffort: 'medium' }, 0.2)
    ).toHaveProperty('reasoning_effort', 'high');
    expect(buildChatParameters({ model: 'glm-5.2', reasoningEffort: 'low' }, 0.2)).toHaveProperty(
      'reasoning_effort',
      'high'
    );
    expect(
      buildChatParameters({ model: 'deepseek-flash', reasoningEffort: 'medium' }, 0.2)
    ).toHaveProperty('reasoning_effort', 'high');
    expect(
      buildChatParameters({ model: 'glm-5.3-flash', reasoningEffort: 'low' }, 0.2)
    ).toHaveProperty('reasoning_effort', 'low');
  });

  it.each([
    'gpt-4.1-mini',
    'gpt-4o',
    'gpt-5-chat-latest',
    'o1-preview',
    'glm-4.7',
    'deepseek-chat',
    'unknown',
  ])('does not assume %s supports effort', (model) => {
    expect(buildChatParameters({ model }, 0.2)).toEqual({ temperature: 0.2 });
  });

  it('omits conflicting sampling parameters on OpenAI reasoning models', () => {
    expect(buildChatParameters({ model: 'gpt-5.2' }, 0.2)).toEqual({ reasoning_effort: 'high' });
    expect(buildChatParameters({ model: 'o3-mini', reasoningEffort: 'low' }, 0.2)).toEqual({
      reasoning_effort: 'low',
    });
    expect(buildChatParameters({ model: 'gpt-5-pro', reasoningEffort: 'low' }, 0.2)).toEqual({
      reasoning_effort: 'high',
    });
  });

  it('allows providers to choose their own effort without disabling thinking', () => {
    expect(buildChatParameters({ model: 'glm-5.3', reasoningEffort: null }, 0.2)).toEqual({
      temperature: 0.2,
    });
    expect(buildChatParameters({ model: 'gpt-5.2', reasoningEffort: null }, 0.2)).toEqual({});
  });

  it.each([false, true])('applies the policy to stream=%s and tool requests', (stream) => {
    const body = buildChatRequestBody(
      { ...DEFAULT_AI_CONFIG.chat, providerId: 'zhipu', model: 'glm-5.3-flash' },
      {
        messages: [],
        temperature: 0.2,
        stream,
        tools: [
          { type: 'function', function: { name: 'test', description: 'test', parameters: {} } },
        ],
      }
    );
    expect(body).toHaveProperty('reasoning_effort', 'high');
    expect(body).toHaveProperty('tool_choice', 'auto');
    expect(body).not.toHaveProperty('thinking');
  });
});
