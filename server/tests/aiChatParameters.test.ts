import { describe, expect, it } from 'bun:test';
import { buildChatParameters, requiresStreamingChat } from '../utils/ai/chatParameters';
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

  it.each(['glm-5.3', 'glm-5.3-flash', 'deepseek-flash', 'deepseek-v4-pro'])(
    '%s enables thinking at high effort',
    (model) => {
      expect(
        buildChatParameters(
          { model, providerId: model.startsWith('glm') ? 'zhipu' : 'deepseek' },
          0.2
        )
      ).toEqual({
        temperature: 0.2,
        reasoning_effort: 'high',
        thinking: { type: 'enabled' },
      });
    }
  );

  it('enables thinking on older GLM models without unsupported effort fields', () => {
    expect(buildChatParameters({ model: 'glm-4.7', providerId: 'zhipu' }, 0.2)).toEqual({
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
      {
        ...DEFAULT_AI_CONFIG.chat,
        providerId: 'zhipu',
        baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        model: 'glm-5.3-flash',
      },
      request
    );
    expect(body).toHaveProperty('reasoning_effort', 'high');
    expect(body).toHaveProperty('thinking', { type: 'enabled' });
    expect(body).toHaveProperty('tool_choice', 'auto');
    expect(body).not.toHaveProperty('enableThinking');
    const local = buildChatRequestBody(
      {
        ...DEFAULT_AI_CONFIG.chat,
        providerId: 'llama-cpp',
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'gemma-4-12b-it',
      },
      request
    );
    expect(local).toHaveProperty('chat_template_kwargs', { enable_thinking: true });
  });

  it.each([
    [
      { providerId: 'openrouter', model: 'anthropic/claude-sonnet-4' },
      { reasoning: { effort: 'high' } },
    ],
    [
      { baseUrl: 'https://openrouter.ai/api/v1', model: 'z-ai/glm-4.7' },
      { reasoning: { effort: 'high' } },
    ],
    [{ providerId: 'openrouter', model: 'openai/gpt-5.2' }, { reasoning: { effort: 'high' } }],
    [
      { baseUrl: 'http://localhost:11434/v1', model: 'gpt-oss:20b' },
      { temperature: 0.2, reasoning_effort: 'high' },
    ],
    [
      { providerId: 'ollama', baseUrl: 'https://ollama.example.test/v1', model: 'qwen3:8b' },
      { temperature: 0.2, reasoning_effort: 'high' },
    ],
    [
      { baseUrl: 'http://127.0.0.1:8080/v1', model: 'gpt-oss-20b' },
      {
        temperature: 0.2,
        reasoning_effort: 'high',
        chat_template_kwargs: { enable_thinking: true, reasoning_effort: 'high' },
      },
    ],
    [{ providerId: 'dashscope', model: 'qwen-max' }, { temperature: 0.2 }],
    [{ providerId: 'dashscope', model: 'qwen-plus-2025-01-25' }, { temperature: 0.2 }],
    [{ providerId: 'dashscope', model: 'qwen3-coder-plus' }, { temperature: 0.2 }],
    [
      { providerId: 'dashscope', model: 'qwen3.5-27b' },
      { temperature: 0.2, enable_thinking: true },
    ],
    [
      { providerId: 'dashscope', model: 'qwen3.8-max' },
      { temperature: 0.2, enable_thinking: true, reasoning_effort: 'high' },
    ],
    [
      { providerId: 'siliconflow', model: 'Pro/zai-org/GLM-5.2' },
      { temperature: 0.2, enable_thinking: true, reasoning_effort: 'high' },
    ],
    [
      { baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V4-Flash' },
      { temperature: 0.2, enable_thinking: true, reasoning_effort: 'high' },
    ],
    [
      { providerId: 'siliconflow', model: 'Qwen/Qwen3-32B' },
      { temperature: 0.2, enable_thinking: true },
    ],
    [{ providerId: 'zhipu', model: 'glm-4.5-airx' }, { temperature: 0.2 }],
    [{ baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.5' }, {}],
    [{ providerId: 'moonshot', model: 'kimi-k2.6' }, {}],
    [{ providerId: 'moonshot', model: 'kimi-k2.7-code-highspeed' }, {}],
    [{ baseUrl: 'https://api.moonshot.ai/v1', model: 'kimi-k3' }, { reasoning_effort: 'high' }],
    [{ providerId: 'moonshot', model: 'moonshot-v1-8k' }, { temperature: 0.2 }],
    [{ baseUrl: 'http://localhost:1234/v1', model: 'gpt-oss-20b' }, { temperature: 0.2 }],
    [
      { providerId: 'custom', baseUrl: 'https://unknown.example/v1', model: 'glm-5.3' },
      { temperature: 0.2 },
    ],
    [
      {
        providerId: 'dashscope',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-sonnet-4',
      },
      { reasoning: { effort: 'high' } },
    ],
  ])('uses the documented wire protocol for %j', (config, expected) => {
    expect(buildChatParameters(config, 0.2)).toEqual(expected);
    expect(buildBrowserChatParameters(config, 0.2)).toEqual(expected);
  });

  it('uses streaming for enabled DashScope models, including synchronous API calls', () => {
    expect(requiresStreamingChat({ providerId: 'dashscope', model: 'qwen3.5-27b' })).toBe(true);
    expect(requiresStreamingChat({ providerId: 'dashscope', model: 'qwen-plus' })).toBe(true);
    expect(requiresStreamingChat({ providerId: 'dashscope', model: 'qwen-max' })).toBe(false);
    expect(requiresStreamingChat({ providerId: 'zhipu', model: 'glm-5.3' })).toBe(false);
  });
});
