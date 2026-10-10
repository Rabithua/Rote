export interface ChatParameterConfig {
  model: string;
  providerId?: string;
  baseUrl?: string;
}

export interface ChatParameters {
  temperature?: number;
  reasoning_effort?: 'high';
  reasoning?: { effort: 'high' };
  enable_thinking?: true;
  thinking?: { type: 'enabled' };
  chat_template_kwargs?: { enable_thinking: true; reasoning_effort?: 'high' };
}

function chatProvider(config: ChatParameterConfig) {
  // The endpoint wins over a stale preset after a user edits their base URL.
  let endpoint: URL | undefined;
  try {
    endpoint = new URL(config.baseUrl?.trim() || '');
  } catch {
    // Empty/invalid endpoints are rejected by the client before dispatch.
  }
  const host = endpoint?.hostname || '';
  if (host === 'openrouter.ai') return 'openrouter';
  if (/^(?:dashscope(?:-intl|-us)?|[a-z0-9.-]+\.maas)\.aliyuncs\.com$/.test(host))
    return 'dashscope';
  if (/^api\.siliconflow\.(?:cn|com)$/.test(host)) return 'siliconflow';
  if (host === 'open.bigmodel.cn' || host === 'api.z.ai') return 'zhipu';
  if (host === 'api.deepseek.com') return 'deepseek';
  if (host === 'api.moonshot.cn' || host === 'api.moonshot.ai') return 'moonshot';
  if (host === 'api.openai.com') return 'openai';
  if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(host)) {
    if (endpoint?.port === '11434') return 'ollama';
    if (endpoint?.port === '1234') return 'lm-studio';
    if (endpoint?.port === '8080') return 'llama-cpp';
  }
  return config.providerId || 'custom';
}

// Thinking is a product default. Only send fields supported by the endpoint/model.
// See docs/ai-provider-parameters.md; browser/server parity is checked in tests.
export function buildChatParameters(
  config: ChatParameterConfig,
  temperature: number
): ChatParameters {
  const fullModel = config.model.trim().toLowerCase();
  const model = (fullModel.split('/').pop() || '').split(':')[0];
  const provider = chatProvider(config);
  const openaiReasoning =
    (/^(o1|o3|o4-mini)(?:-|$)/.test(model) &&
      !/^(o1-mini|o1-preview|o1-pro|o3-pro)(?:-|$)/.test(model)) ||
    (/^gpt-[56](?:[.-]|$)/.test(model) && !model.includes('chat'));
  const glmEffort = /^glm-5\.[23](?:-|$)/.test(model);
  const glmThinking =
    /^glm-(?:4\.[567]v?|5(?:\.[123])?|5v)(?:-|$)/.test(model) && !model.includes('airx');
  const deepseekEffort = /^deepseek-(?:flash|v4(?:-pro|-flash)?)(?:-|$)/.test(model);
  const deepseekThinking = deepseekEffort || /^deepseek-v3\.[12](?:-|$)/.test(model);
  const qwenThinking =
    (/^qwen3(?:[.-]|$)/.test(model) && !/coder|instruct/.test(model)) ||
    /^qwen-(?:plus|turbo|flash)(?:-latest)?$/.test(model);
  const gptOss = /^gpt-oss(?:[:-]|$)/.test(model);
  const localThinking =
    glmThinking || deepseekThinking || qwenThinking || gptOss || /^gemma-4(?:[:-]|$)/.test(model);

  if (provider === 'openrouter') {
    const reasoning =
      openaiReasoning ||
      glmThinking ||
      deepseekThinking ||
      qwenThinking ||
      /^claude-(?:3\.7|sonnet-4|opus-4|haiku-4)(?:[.-]|$)/.test(model) ||
      /^gemini-(?:2\.5|3)(?:[.-]|$)/.test(model) ||
      gptOss;
    return {
      ...(!reasoning ? { temperature } : {}),
      ...(reasoning ? { reasoning: { effort: 'high' } } : {}),
    };
  }
  if (provider === 'ollama') {
    return { temperature, ...(localThinking ? { reasoning_effort: 'high' } : {}) };
  }
  if (provider === 'llama-cpp') {
    return {
      temperature,
      ...(localThinking
        ? {
            chat_template_kwargs: {
              enable_thinking: true,
              ...(gptOss ? { reasoning_effort: 'high' as const } : {}),
            },
          }
        : {}),
      ...(gptOss ? { reasoning_effort: 'high' } : {}),
    };
  }
  // LM Studio's Chat Completions reference does not promise either thinking extension.
  if (provider === 'lm-studio') return { temperature };
  if (provider === 'moonshot') {
    // Kimi thinking models fix sampling values and already enable thinking by default.
    if (/^kimi-k3(?:-|$)/.test(model)) return { reasoning_effort: 'high' };
    if (/^kimi-k2\.(?:[56]|7-code)(?:-|$)/.test(model)) return {};
    return { temperature };
  }
  if (provider === 'dashscope') {
    const thinking =
      glmThinking || deepseekThinking || qwenThinking || /^kimi-k2\.[567](?:-|$)/.test(model);
    const effort =
      glmEffort || /^deepseek-v4(?:[.-]|$)/.test(model) || /^qwen3\.8(?:-|$)/.test(model);
    return {
      temperature,
      ...(thinking ? { enable_thinking: true } : {}),
      ...(effort ? { reasoning_effort: 'high' } : {}),
    };
  }
  if (provider === 'siliconflow') {
    const thinking = glmThinking || deepseekThinking || qwenThinking;
    const effort =
      /^(?:pro\/deepseek-ai\/deepseek-v4|deepseek-ai\/deepseek-v4-flash|pro\/zai-org\/glm-5\.2)(?:-|$)/.test(
        fullModel
      );
    return {
      temperature,
      ...(thinking ? { enable_thinking: true } : {}),
      ...(effort ? { reasoning_effort: 'high' } : {}),
    };
  }
  if (provider === 'zhipu' && glmThinking) {
    return {
      temperature,
      thinking: { type: 'enabled' },
      ...(glmEffort ? { reasoning_effort: 'high' } : {}),
    };
  }
  if (provider === 'deepseek' && deepseekThinking) {
    return {
      temperature,
      thinking: { type: 'enabled' },
      ...(deepseekEffort ? { reasoning_effort: 'high' } : {}),
    };
  }
  if (openaiReasoning) return { reasoning_effort: 'high' };
  // Other providers/legacy/unknown models keep their native defaults.
  return { temperature };
}

export function requiresStreamingChat(config: ChatParameterConfig): boolean {
  // Use the already-supported streaming transport even for public synchronous APIs.
  return (
    chatProvider(config) === 'dashscope' &&
    buildChatParameters(config, 0.2).enable_thinking === true
  );
}
