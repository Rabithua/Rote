import { describe, expect, it } from 'bun:test';
import { buildChatParameters } from '../utils/ai/chatParameters';
import { buildChatParameters as buildBrowserChatParameters } from '../../web/src/utils/chatParameters';
import { buildChatRequestBody } from '../utils/ai/clientShared';
import { DEFAULT_AI_CONFIG, mergeAiConfig } from '../utils/ai/providers';
import { parseIncomingAiConfig } from '../embeddings/configStore';
import { embeddingFingerprint } from '../embeddings/contract';

describe('default thinking and fixed reasoning effort', () => {
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

  it.each([null, 'low', 'medium'])(
    'normalizes saved effort %s to high without changing the embedding index',
    (effort) => {
      const stored = mergeAiConfig();
      const legacy = { ...stored, chat: { ...stored.chat, reasoningEffort: effort as 'high' } };
      const parsed = parseIncomingAiConfig(legacy, stored);
      expect(parsed.chat.reasoningEffort).toBe('high');
      expect(embeddingFingerprint(parsed)).toBe(embeddingFingerprint(stored));
    }
  );

  it('defaults new and missing chat settings to high', () => {
    expect(DEFAULT_AI_CONFIG.chat.reasoningEffort).toBe('high');
    const { reasoningEffort: _effort, ...legacyChat } = DEFAULT_AI_CONFIG.chat;
    expect(mergeAiConfig({ chat: legacyChat }).chat.reasoningEffort).toBe('high');
    expect(DEFAULT_AI_CONFIG.embedding).not.toHaveProperty('reasoningEffort');
  });

  it('keeps reasoning effort out of embedding settings', () => {
    const stored = mergeAiConfig();
    expect(() =>
      parseIncomingAiConfig(
        {
          ...stored,
          embedding: { ...stored.embedding, reasoningEffort: 'high' },
        },
        stored
      )
    ).toThrow('embedding_config_invalid');
  });

  it.each(['glm-5.3', 'glm-5.3-flash', 'z-ai/glm-5.3-flash', 'deepseek-flash', 'deepseek-v4-pro'])(
    '%s enables thinking at high effort',
    (model) => {
      expect(buildChatParameters({ model }, 0.2)).toEqual({
        temperature: 0.2,
        reasoning_effort: 'high',
        thinking: { type: 'enabled' },
      });
    }
  );

  it('enables thinking on older GLM models without unsupported effort fields', () => {
    expect(buildChatParameters({ model: 'glm-4.7' }, 0.2)).toEqual({
      temperature: 0.2,
      thinking: { type: 'enabled' },
    });
  });

  it.each([
    'gpt-4.1-mini',
    'gpt-4o',
    'gpt-5-chat-latest',
    'o1-preview',
    'glm-4-flash',
    'deepseek-chat',
    'unknown',
  ])('does not add unsupported thinking fields to %s', (model) => {
    expect(buildChatParameters({ model }, 0.2)).toEqual({ temperature: 0.2 });
  });

  it.each(['gpt-5.2', 'o3-mini'])('keeps %s at high even with old opt-out settings', (model) => {
    const legacy = { model, reasoningEffort: null };
    expect(buildChatParameters(legacy, 0.2)).toEqual({ reasoning_effort: 'high' });
  });

  it.each([
    { providerId: 'dashscope', baseUrl: 'https://example.test/v1' },
    { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
    { baseUrl: 'https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' },
  ])('enables DashScope thinking in both clients', (provider) => {
    const config = { ...provider, model: 'qwen-plus' };
    expect(buildChatParameters(config, 0.2)).toEqual({ temperature: 0.2, enable_thinking: true });
    expect(buildBrowserChatParameters(config, 0.2)).toEqual(buildChatParameters(config, 0.2));
  });

  it.each([false, true])('ignores old request toggles in stream=%s and tool requests', (stream) => {
    const request = {
      messages: [],
      temperature: 0.2,
      stream,
      enableThinking: false,
      tools: [
        {
          type: 'function' as const,
          function: { name: 'test', description: 'test', parameters: {} },
        },
      ],
    };
    const body = buildChatRequestBody(
      { ...DEFAULT_AI_CONFIG.chat, providerId: 'zhipu', model: 'glm-5.3-flash' },
      request
    );
    expect(body).toHaveProperty('reasoning_effort', 'high');
    expect(body).toHaveProperty('thinking', { type: 'enabled' });
    expect(body).toHaveProperty('tool_choice', 'auto');
    expect(body).not.toHaveProperty('enableThinking');
    const local = buildChatRequestBody(
      { ...DEFAULT_AI_CONFIG.chat, providerId: 'llama-cpp', model: 'gemma' },
      request
    );
    expect(local).toHaveProperty('chat_template_kwargs', { enable_thinking: true });
  });
});
